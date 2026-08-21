#!/usr/bin/env bash
#
# Set ONE variable in the production config, safely.
#
# WHY THIS EXISTS
# ---------------
# Hand-editing the whole config produced three defects in a row (a missing
# colon in a URL, an unreplaced instruction string, a stray " = "), and
# ad-hoc one-liners have their own failure modes: PowerShell captures
# multi-line output as an array and flattens it with spaces on upload,
# pasted multi-line blocks silently skip parts of themselves.
#
# This changes exactly one line, shows you the result BEFORE writing, and
# refuses to upload if the variable count changed — which is what a mangled
# config looks like.
#
# The value is read from a hidden prompt, so a live secret never reaches
# shell history, the terminal scrollback, or a file on disk.
#
# Usage:
#   ./set-prod-env-var.sh api STRIPE_SECRET_KEY
#   ./set-prod-env-var.sh web NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
#
set -euo pipefail
export MSYS_NO_PATHCONV=1   # Git Bash on Windows mangles /sc/... into a path

REGION="us-west-1"
EXPECTED_ACCOUNT="372110294387"

TARGET="${1:-}"
VAR="${2:-}"

if [[ -z "$TARGET" || -z "$VAR" ]]; then
  echo "usage: $0 <api|web> <VARIABLE_NAME>" >&2
  exit 1
fi

case "$TARGET" in
  api) PARAM="/sc/prod/api/dotenv"; TIER="Advanced" ;;
  web) PARAM="/sc/prod/web/dotenv"; TIER="Standard" ;;
  *)   echo "target must be 'api' or 'web'" >&2; exit 1 ;;
esac

ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
[[ "$ACCOUNT" == "$EXPECTED_ACCOUNT" ]] || { echo "ERROR: wrong account ($ACCOUNT)" >&2; exit 1; }

# ── Read the value without echoing it ────────────────────────────────────────
printf 'Value for %s (input hidden): ' "$VAR" >&2
read -rs VALUE
echo >&2

[[ -n "$VALUE" ]] || { echo "ERROR: empty value" >&2; exit 1; }

# ── Shape checks for the keys where a mix-up is expensive ────────────────────
case "$VAR" in
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
    # This one is COMPILED INTO THE BROWSER BUNDLE. A secret key here is
    # published to every visitor and has to be revoked immediately.
    [[ "$VALUE" == sk_* ]] && { echo "ERROR: that is a SECRET key - never in a NEXT_PUBLIC_ variable" >&2; exit 1; }
    [[ "$VALUE" == pk_* ]] || { echo "ERROR: expected a publishable key (pk_live_ or pk_test_)" >&2; exit 1; }
    ;;
  STRIPE_SECRET_KEY)
    [[ "$VALUE" == sk_* || "$VALUE" == rk_* ]] || { echo "ERROR: expected sk_live_/sk_test_ (or a restricted rk_ key)" >&2; exit 1; }
    ;;
  STRIPE_WEBHOOK_SECRET|STRIPE_IDENTITY_WEBHOOK_SECRET)
    [[ "$VALUE" == whsec_* ]] || { echo "ERROR: expected a signing secret (whsec_...)" >&2; exit 1; }
    ;;
  STRIPE_SUBSCRIPTION_PRICE_MONTHLY|STRIPE_SUBSCRIPTION_PRICE_ANNUAL)
    # A bare amount is silently ignored by the code and falls through to
    # lazily CREATING a Price in live Stripe. Catch it here instead.
    [[ "$VALUE" == price_* ]] || { echo "ERROR: expected a Price ID (price_...), not an amount" >&2; exit 1; }
    ;;
  PASSPORT_ENCRYPTION_KEY)
    echo "REFUSING: this key is managed by compose-prod-env.sh and must never be replaced -" >&2
    echo "          every stored passport would become undecryptable." >&2
    exit 1
    ;;
esac

# Newlines would corrupt the file; a trailing space is invisible and breaks
# credentials in ways that look like a permissions problem.
[[ "$VALUE" != *$'\n'* ]] || { echo "ERROR: value contains a newline" >&2; exit 1; }
[[ "$VALUE" == "${VALUE% }" ]] || { echo "ERROR: value has a trailing space" >&2; exit 1; }

# ── Fetch, substitute, verify, upload ────────────────────────────────────────
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

aws ssm get-parameter --region "$REGION" --name "$PARAM" --with-decryption \
  --query Parameter.Value --output text > "$TMP/current"

BEFORE=$(grep -cE '^[A-Z_]+=' "$TMP/current")
[[ "$BEFORE" -gt 0 ]] || { echo "ERROR: fetched config has no variables - refusing to touch it" >&2; exit 1; }

if grep -qE "^${VAR}=" "$TMP/current"; then
  # `|` as the delimiter, and the value passed via an awk variable, so a key
  # containing / or & cannot be interpreted as part of the expression.
  awk -v k="$VAR" -v v="$VALUE" '
    $0 ~ "^" k "=" { print k "=" v; next } { print }
  ' "$TMP/current" > "$TMP/new"
  ACTION="updated"
else
  cp "$TMP/current" "$TMP/new"
  printf '%s=%s\n' "$VAR" "$VALUE" >> "$TMP/new"
  ACTION="added"
fi

AFTER=$(grep -cE '^[A-Z_]+=' "$TMP/new")

echo
echo "  parameter : $PARAM"
echo "  action    : $ACTION $VAR"
echo "  variables : $BEFORE -> $AFTER"
# Show only enough to confirm the right value, never the whole secret.
echo "  value     : $(grep -E "^${VAR}=" "$TMP/new" | cut -d= -f2- | cut -c1-12)..."
echo

if [[ "$ACTION" == "updated" && "$AFTER" -ne "$BEFORE" ]]; then
  echo "ERROR: variable count changed on an update - aborting" >&2; exit 1
fi
if [[ "$ACTION" == "added" && "$AFTER" -ne $((BEFORE + 1)) ]]; then
  echo "ERROR: unexpected variable count after add - aborting" >&2; exit 1
fi

aws ssm put-parameter --region "$REGION" --name "$PARAM" \
  --type SecureString --tier "$TIER" \
  --value "$(cat "$TMP/new")" --overwrite >/dev/null

echo "Uploaded. NOTE: this takes effect on the NEXT DEPLOY."
case "$VAR" in
  NEXT_PUBLIC_*)
    echo "      NEXT_PUBLIC_* is inlined at BUILD time, so it needs a full"
    echo "      rebuild - a restart alone will keep serving the old value."
    ;;
esac
