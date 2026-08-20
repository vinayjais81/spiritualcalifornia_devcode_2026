/**
 * Production PostgreSQL.
 *
 * Launch tier: db.t4g.small, single-AZ, 20 GB with autoscaling. See
 * variables.tf for what each choice trades away and the trigger to change it.
 */

resource "aws_db_subnet_group" "main" {
  name        = "sc-prod-db-subnet-group"
  description = "Private data subnets. These have no default route to the internet."
  subnet_ids  = data.terraform_remote_state.network.outputs.data_subnet_ids

  tags = { Name = "sc-prod-db-subnet-group" }
}

/**
 * Parameter group.
 *
 * `rds.force_ssl = 1` is the one that matters: it makes an unencrypted
 * connection impossible rather than merely discouraged. A misconfigured
 * client then fails loudly at connect time instead of silently sending
 * credentials and customer data in the clear.
 *
 * Consequence for the app: DATABASE_URL must carry `sslmode=require`.
 */
resource "aws_db_parameter_group" "main" {
  name        = "sc-prod-pg${var.postgres_version}"
  family      = "postgres${var.postgres_version}"
  description = "Production PostgreSQL parameters."

  parameter {
    name         = "rds.force_ssl"
    value        = "1"
    apply_method = "pending-reboot"
  }

  # Log anything slower than a second. At launch volumes this is nearly
  # silent, and it is the cheapest possible source of truth when someone
  # reports that a page "got slow".
  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  lifecycle {
    create_before_destroy = true
  }

  tags = { Name = "sc-prod-pg-params" }
}

/**
 * Master password.
 *
 * Generated here and written to SSM Parameter Store, which is where the
 * operator reads it when composing DATABASE_URL for /sc/prod/api/dotenv.
 *
 * Note it is also stored in Terraform state. State lives in an encrypted,
 * versioned, private S3 bucket, which is an acceptable place for it — but it
 * is the reason state access is treated as production-credential access.
 *
 * Excludes characters that need escaping in a URI, since this value ends up
 * inside a postgresql:// connection string.
 */
resource "random_password" "db_master" {
  length           = 32
  special          = true
  override_special = "-_.~"
}

resource "aws_db_instance" "main" {
  identifier = "sc-prod-rds-pg"

  engine         = "postgres"
  engine_version = var.postgres_version
  instance_class = var.db_instance_class

  # ── Storage ──────────────────────────────────────────────────────────────
  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.data.arn

  # ── Credentials ──────────────────────────────────────────────────────────
  db_name  = "spiritual_california"
  username = "scadmin"
  password = random_password.db_master.result

  # ── Placement ────────────────────────────────────────────────────────────
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [data.terraform_remote_state.network.outputs.rds_security_group_id]
  multi_az               = var.db_multi_az

  # Never. The instance is reachable only from the app security group, and
  # the data subnets have no route to the internet in the first place.
  publicly_accessible = false

  parameter_group_name = aws_db_parameter_group.main.name

  # ── Backups ──────────────────────────────────────────────────────────────
  backup_retention_period = var.db_backup_retention_days
  backup_window           = "09:00-10:00" # ~02:00 Pacific, off-peak
  copy_tags_to_snapshot   = true

  # ── Maintenance ──────────────────────────────────────────────────────────
  maintenance_window          = "tue:10:00-tue:11:00"
  auto_minor_version_upgrade  = true
  allow_major_version_upgrade = false

  # ── Observability ────────────────────────────────────────────────────────
  # 7 days of Performance Insights is the free tier. Worth having from day
  # one: diagnosing a slow query is far easier with the history already
  # recorded than with monitoring added after the complaint.
  performance_insights_enabled          = true
  performance_insights_retention_period = 7

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  # ── Protection ───────────────────────────────────────────────────────────
  deletion_protection = true

  # Refuse to destroy without an operator explicitly taking a final snapshot.
  skip_final_snapshot       = false
  final_snapshot_identifier = "sc-prod-rds-final-snapshot"

  # Applied in the maintenance window rather than immediately, so a routine
  # terraform apply cannot bounce production's database mid-afternoon.
  apply_immediately = false

  lifecycle {
    prevent_destroy = true

    # AWS moves this as storage autoscaling acts; Terraform should not keep
    # trying to shrink it back to the starting value.
    ignore_changes = [allocated_storage]
  }

  tags = { Name = "sc-prod-rds-pg" }
}
