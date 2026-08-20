#!/usr/bin/env bash
#
# Create the application's database role.
#
# WHY THIS IS NOT TERRAFORM
# -------------------------
# RDS lives in private subnets with no public access and no route to the
# internet, so nothing outside the VPC can open a Postgres connection to it —
# including Terraform on a workstation. That is the design working as
# intended, not a gap to engineer around. Terraform's postgresql provider
# would need the database exposed, which is a worse trade than running this
# script once from inside.
#
# WHY A SEPARATE ROLE AT ALL
# --------------------------
# The app should not connect as the RDS master. The master can drop the
# database, alter roles, and read everything; the app needs to read and write
# rows. If the application is ever compromised — an injection flaw, a leaked
# .env — the difference between those two sets of privileges is the
# difference between a data breach and a catastrophe.
#
# WHERE TO RUN IT
# ---------------
# From a production app instance, via SSM Session Manager:
#
#   aws ssm start-session --target <instance-id> --region us-west-1
#   sudo dnf install -y postgresql16   # client only
#   ./bootstrap-db.sh
#
set -euo pipefail

REGION="us-west-1"
EXPECTED_ACCOUNT="372110294387"
DB_NAME="spiritual_california"
APP_USER="sc_app"

command -v psql >/dev/null || { echo "ERROR: psql not installed. Install the postgresql client first." >&2; exit 1; }

ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
[[ "$ACCOUNT" == "$EXPECTED_ACCOUNT" ]] || { echo "ERROR: wrong account ($ACCOUNT). Refusing." >&2; exit 1; }

echo "Reading connection details from Parameter Store..."
ENDPOINT=$(aws ssm get-parameter --region "$REGION" --name /sc/prod/rds/endpoint --query Parameter.Value --output text)
MASTER_PW=$(aws ssm get-parameter --region "$REGION" --name /sc/prod/rds/master-password --with-decryption --query Parameter.Value --output text)

HOST="${ENDPOINT%%:*}"
PORT="${ENDPOINT##*:}"

# Generate the app password here rather than reusing anything. It never
# passes through a shell argument, only stdin and an env var.
APP_PW=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)

echo "Creating role ${APP_USER} on ${HOST}..."

# sslmode=require, because rds.force_ssl=1 rejects anything else.
PGPASSWORD="$MASTER_PW" psql \
  "host=$HOST port=$PORT dbname=$DB_NAME user=scadmin sslmode=require" \
  -v ON_ERROR_STOP=1 \
  -v app_user="$APP_USER" \
  -v app_pw="$APP_PW" <<'SQL'
-- Idempotent: safe to re-run, and re-running rotates the password.
--
-- Deliberately NOT a DO $$ ... $$ block. psql performs variable
-- interpolation while lexing its input, and it explicitly skips the inside
-- of quoted literals and dollar-quoted strings — so :'app_user' inside a DO
-- block reaches the server verbatim and fails. Generating the statement with
-- format() and running it through \gexec keeps the substitution in psql,
-- where it works.
--
-- format() is still used for %I / %L quoting, so a password containing
-- punctuation cannot break out of the statement.

-- Postgres has no CREATE ROLE IF NOT EXISTS.
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'app_user', :'app_pw')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user')
\gexec

-- And rotate it if the role was already there.
SELECT format('ALTER ROLE %I LOGIN PASSWORD %L', :'app_user', :'app_pw')
WHERE EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user')
\gexec

GRANT CONNECT ON DATABASE spiritual_california TO :"app_user";

-- CREATE on the schema is required: `prisma migrate deploy` runs as this
-- role and has to be able to add tables. It is the one elevated privilege
-- the app genuinely needs.
GRANT USAGE, CREATE ON SCHEMA public TO :"app_user";

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO :"app_user";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO :"app_user";

-- Without these, tables created by a FUTURE migration would be inaccessible
-- to the app until someone re-ran the grants. This is the line that stops a
-- deploy succeeding and the app then 500ing on the new table.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"app_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO :"app_user";
SQL

echo
echo "Role ${APP_USER} created. Storing its password in Parameter Store..."
aws ssm put-parameter --region "$REGION" \
  --name /sc/prod/rds/app-password \
  --description "Password for the sc_app role. Goes into DATABASE_URL." \
  --type SecureString \
  --value "$APP_PW" \
  --overwrite >/dev/null

echo
echo "Done. Put this in DATABASE_URL inside /sc/prod/api/dotenv:"
echo
echo "  postgresql://${APP_USER}:<value of /sc/prod/rds/app-password>@${ENDPOINT}/${DB_NAME}?schema=public&sslmode=require"
echo
echo "Then verify the app can connect but cannot do more than it should:"
echo "  psql \"host=$HOST port=$PORT dbname=$DB_NAME user=$APP_USER sslmode=require\" -c 'SELECT 1'"
