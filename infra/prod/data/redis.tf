/**
 * ElastiCache Redis — BullMQ queues and the (currently gated-off) cache.
 *
 * This is the first time the application meets a REMOTE, AUTHENTICATED Redis:
 * QA runs it on localhost. That transition is exactly what surfaced the boot
 * hang fixed in commit d0af2eb, where a queue awaiting an unreachable Redis
 * stalled Nest's bootstrap forever.
 *
 * Re-run the Redis-down boot test against this instance before trusting an
 * Auto Scaling group to replace instances unattended.
 */

resource "aws_elasticache_subnet_group" "main" {
  name        = "sc-prod-redis-subnet-group"
  description = "Private data subnets."
  subnet_ids  = data.terraform_remote_state.network.outputs.data_subnet_ids

  tags = { Name = "sc-prod-redis-subnet-group" }
}

/**
 * `noeviction` is the load-bearing setting.
 *
 * The Redis default, allkeys-lru, silently discards keys under memory
 * pressure — and the keys here are BullMQ jobs: stock-hold releases, payout
 * runs, invite scheduling. Losing those is a correctness failure that
 * produces no error anywhere.
 *
 * With noeviction, a full Redis REJECTS writes instead, which is loud and
 * recoverable. The corresponding requirement is an alarm on memory usage —
 * see the alarm below.
 */
resource "aws_elasticache_parameter_group" "main" {
  name        = "sc-prod-redis7"
  family      = "redis7"
  description = "Production Redis parameters."

  parameter {
    name  = "maxmemory-policy"
    value = "noeviction"
  }

  lifecycle {
    create_before_destroy = true
  }

  tags = { Name = "sc-prod-redis-params" }
}

/**
 * AUTH token.
 *
 * ElastiCache requires the token to be alphanumeric-ish; several punctuation
 * characters are rejected outright, and this value also has to survive being
 * placed in a rediss:// URL for CacheService. Letters and digits only avoids
 * both problems.
 */
resource "random_password" "redis_auth" {
  length  = 48
  special = false
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "sc-prod-redis"
  description          = "BullMQ queues and application cache."

  engine         = "redis"
  engine_version = "7.1"
  node_type      = var.redis_node_type
  port           = 6379

  # Cluster mode DISABLED. BullMQ and ioredis expect a single logical
  # endpoint; cluster mode would require hash-tag-aware key design the
  # application does not have.
  num_cache_clusters = var.redis_replica_count + 1

  # Failover needs at least one replica, so both follow the same variable.
  automatic_failover_enabled = var.redis_replica_count > 0
  multi_az_enabled           = var.redis_replica_count > 0

  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [data.terraform_remote_state.network.outputs.redis_security_group_id]
  parameter_group_name = aws_elasticache_parameter_group.main.name

  # ── Encryption ───────────────────────────────────────────────────────────
  at_rest_encryption_enabled = true
  kms_key_id                 = aws_kms_key.data.arn

  # In transit requires REDIS_TLS=true in the API environment, and rediss://
  # (two s) for CacheService's REDIS_URL. Miss either and every worker fails
  # to connect.
  transit_encryption_enabled = var.redis_transit_encryption
  auth_token                 = var.redis_transit_encryption ? random_password.redis_auth.result : null

  # ── Maintenance ──────────────────────────────────────────────────────────
  maintenance_window       = "tue:11:00-tue:12:00" # after the RDS window
  snapshot_retention_limit = 1                     # queue state, not a system of record
  snapshot_window          = "09:00-10:00"

  auto_minor_version_upgrade = true
  apply_immediately          = false

  tags = { Name = "sc-prod-redis" }
}

/**
 * Memory alarm — the other half of choosing noeviction.
 *
 * Having opted for "reject writes" over "silently drop jobs", we need to
 * know before it reaches that point. A full Redis stops accepting new jobs,
 * which stops stock holds being released and payouts being scheduled.
 */
resource "aws_cloudwatch_metric_alarm" "redis_memory" {
  alarm_name          = "sc-prod-redis-memory-high"
  alarm_description   = "Redis memory above 75%. With noeviction, a full Redis REJECTS new jobs — stock holds and payouts stop being scheduled."
  namespace           = "AWS/ElastiCache"
  metric_name         = "DatabaseMemoryUsagePercentage"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = 75
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "missing"

  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.main.id
  }

  alarm_actions = [data.aws_sns_topic.alerts.arn]

  tags = { Name = "sc-prod-redis-memory-alarm" }
}

data "aws_sns_topic" "alerts" {
  name = "sc-prod-alerts"
}
