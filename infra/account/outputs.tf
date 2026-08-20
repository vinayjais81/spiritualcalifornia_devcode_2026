output "github_deploy_role_arn" {
  description = "Put this in deploy-prod.yml as role-to-assume (P8). No AWS keys needed in GitHub."
  value       = aws_iam_role.github_deploy.arn
}

output "alerts_topic_arn" {
  description = "SNS topic the P10 CloudWatch alarms publish to."
  value       = aws_sns_topic.alerts.arn
}

output "audit_log_bucket" {
  description = "CloudTrail and AWS Config delivery target."
  value       = aws_s3_bucket.logs.id
}

output "guardduty_detector_id" {
  description = "Empty when GuardDuty is disabled."
  value       = try(aws_guardduty_detector.main[0].id, "")
}

output "next_steps" {
  description = "Things terraform apply cannot do for you."
  value = <<-EOT
    1. CONFIRM THE SNS EMAIL SUBSCRIPTION. AWS has sent a link to
       ${var.alert_email}. Until it is clicked the topic delivers to nobody,
       and Terraform reports success regardless.

    2. Create the GitHub Environment "${var.github_environment}" in
       ${var.github_org}/${var.github_repo}, with required reviewers. The
       deploy role's trust policy is pinned to it, so without it no workflow
       can assume the role.

    3. Tag the QA resources:  infra/scripts/tag-qa-resources.sh
       The isolation permission boundary matches on Environment tags, so
       untagged QA resources sit outside the policy.

    4. Next stack: P2 network (infra/prod/network).
  EOT
}
