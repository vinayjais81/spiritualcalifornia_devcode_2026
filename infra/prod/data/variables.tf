variable "region" {
  type    = string
  default = "us-west-1"
}

variable "account_id" {
  type    = string
  default = "372110294387"
}

# ─── PostgreSQL ──────────────────────────────────────────────────────────────

variable "postgres_version" {
  description = <<-EOT
    Match QA, which runs 17.9 (verified against the live instance 2026-08-20).
    The original plan said 16; that was wrong.

    Pinned to the major version only so AWS can apply minor patches in the
    maintenance window. Pinning the full 17.9 would freeze security patches
    behind a Terraform change.
  EOT
  type        = string
  default     = "17"
}

variable "db_instance_class" {
  description = <<-EOT
    Launch tier: db.t4g.small (2 vCPU burstable, 2 GB RAM, ~$31/mo).

    Anchor for the sizing: QA has run db.t3.micro — 1 GB — through all of
    development. This is double the memory and a newer generation, so it is
    not a downgrade of anything proven.

    Connections are not the constraint: ~225 max at 2 GB against an app pool
    of 10 per process. Memory and CPU credits are what to watch.

    UPGRADE TRIGGER: db.t4g.medium (~$62/mo) when FreeableMemory sits under
    ~200 MB, or when CPUCreditBalance trends down across a week. Background
    jobs — payout reconciliation, ledger integrity, FTS ranking, bulk import
    — are heavier than the request path and are what will move it first.
  EOT
  type        = string
  default     = "db.t4g.small"
}

variable "db_multi_az" {
  description = <<-EOT
    false at launch (~$31/mo), true doubles it (~$62/mo).

    What false costs you: a host or AZ failure is 10-30 minutes of hard
    downtime while AWS recovers the instance, rather than 60-120 seconds of
    automatic failover. Data is safe either way — that is what PITR is for —
    this is purely an availability trade.

    UPGRADE TRIGGER: turn on when real money flows daily, or before the first
    marketing push. It is a flag change with a brief failover, not a
    migration, precisely because P2 provisioned data subnets in both AZs.
  EOT
  type        = bool
  default     = false
}

variable "db_allocated_storage" {
  description = "Starting size in GB. RDS storage can only grow, never shrink, so start small and let autoscaling handle it."
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = <<-EOT
    Storage autoscaling ceiling. This is the setting that makes a 20 GB start
    safe: without it, a full disk takes the database down hard.

    Production launches with an empty database (see the pre-launch purge doc)
    and images live in S3 rather than Postgres, so 20 GB is a generous start
    rather than a tight one.
  EOT
  type        = number
  default     = 100
}

variable "db_backup_retention_days" {
  description = <<-EOT
    Point-in-time recovery window.

    Not compromised at any cost tier: downtime is recoverable, data loss is
    not. 7 days is the floor; the full plan calls for 14 once production
    carries real orders.
  EOT
  type        = number
  default     = 7
}

# ─── Redis ───────────────────────────────────────────────────────────────────

variable "redis_node_type" {
  description = "cache.t4g.micro, ~$13/mo. Redis here holds queue state, not a working set — it does not need to be large."
  type        = string
  default     = "cache.t4g.micro"
}

variable "redis_replica_count" {
  description = <<-EOT
    0 at launch (single node, ~$13/mo). 1 adds a replica plus automatic
    failover (~$26/mo).

    What 0 costs you: if the node fails, queued jobs are lost — stock-hold
    releases, payout runs, invite scheduling. Recoverable but messy, and the
    app now survives Redis being unreachable at boot (see the Redis boot-hang
    fix), so it degrades rather than dies.
  EOT
  type        = number
  default     = 0
}

variable "redis_transit_encryption" {
  description = <<-EOT
    TLS in transit. Requires REDIS_TLS=true in the API's environment, which
    buildQueueConnection() and CacheService already support.

    On by default: the traffic crosses AZs inside the VPC, and the queues
    carry payout and order data.
  EOT
  type        = bool
  default     = true
}
