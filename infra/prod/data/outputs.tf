output "rds_endpoint" {
  value = aws_db_instance.main.endpoint
}

output "redis_endpoint" {
  value = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "kms_key_arn" {
  value = aws_kms_key.data.arn
}

output "next_steps" {
  description = "What terraform cannot do from here."
  value       = <<-EOT
    1. CREATE THE APPLICATION DATABASE USER.

       The app must NOT connect as the RDS master. Terraform cannot create
       the sc_app role itself: RDS sits in private subnets with no public
       access, so there is no route from this workstation to Postgres. That
       is the design working, not a gap.

       Run infra/scripts/bootstrap-db.sh once an app instance exists (P6),
       from inside the VPC via SSM Session Manager.

    2. COMPOSE THE PRODUCTION ENV.

       A filled-in starting point is at /sc/prod/api/dotenv-template, with
       the RDS and Redis endpoints already substituted. Copy it, replace
       every PLACEHOLDER, and save it as /sc/prod/api/dotenv.

       Values you will need:
         /sc/prod/rds/master-password   (to create sc_app, not for the app)
         /sc/prod/redis/auth-token      (becomes REDIS_PASSWORD)

    3. WATCH THE FIRST BILL.
       This stack is the first meaningful spend: roughly $47/month for RDS
       plus ElastiCache, on top of the ~$4 network. The $100 budget alarm
       now has something real to measure.

    4. Next stack: P4 storage (S3 + CloudFront).
  EOT
}

output "monthly_cost_note" {
  value = <<-EOT
    RDS  ${var.db_instance_class} ${var.db_multi_az ? "Multi-AZ" : "single-AZ"} + ${var.db_allocated_storage}GB
    Redis ${var.redis_node_type} x${var.redis_replica_count + 1}${var.redis_replica_count > 0 ? " (failover enabled)" : " (single node)"}
    KMS   1 customer-managed key (~$1)

    Approx: $${var.db_multi_az ? "78" : "47"}/month at these settings.

    To raise availability later, without a rebuild:
      db_multi_az         = true    # 60-120s failover instead of 10-30min
      redis_replica_count = 1       # queue state survives a node failure
  EOT
}
