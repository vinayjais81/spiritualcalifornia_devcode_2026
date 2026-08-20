output "alb_dns_name" {
  description = "Test the whole stack through this before the domain exists. Becomes the Route 53 ALIAS target in P7."
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "Needed for the Route 53 ALIAS record in P7."
  value       = aws_lb.main.zone_id
}

output "asg_name" {
  value = aws_autoscaling_group.app.name
}

output "web_target_group_arn" {
  value = aws_lb_target_group.web.arn
}

output "api_target_group_arn" {
  value = aws_lb_target_group.api.arn
}

output "instance_role_arn" {
  value = aws_iam_role.app.arn
}

output "next_steps" {
  value = <<-EOT
    The instance is READY but EMPTY. It has Node, PM2, the SSM agent and the
    CloudWatch agent, and no application code — deploys arrive via SSM in P8
    rather than by giving a production host credentials to the source repo.

    1. CONNECT AND CONFIRM. No SSH port exists; use Session Manager:
         aws ssm describe-instance-information --region ${var.region} \
           --query "InstanceInformationList[].InstanceId"
         aws ssm start-session --target <instance-id> --region ${var.region}
       Then check the bootstrap actually finished:
         sudo tail -50 /var/log/sc-bootstrap.log

    2. CREATE THE APPLICATION DATABASE ROLE. This is the moment
       bootstrap-db.sh becomes runnable — it needs to be inside the VPC,
       which is exactly what this instance now provides:
         infra/scripts/bootstrap-db.sh

    3. COMPOSE /sc/prod/api/dotenv from the template, now that every value
       is known. Remember DATABASE_URL takes the sc_app password from step 2,
       not the master password.

    4. DEPLOY (P8), then FLIP THE HEALTH CHECK:
         health_check_type = "ELB"
       Until then a hung Node process still counts as healthy, because EC2
       checks only ask whether the machine is alive.

    5. HTTPS arrives with P7. While acm_certificate_arn is empty there is no
       443 listener and port 80 serves directly — which is what makes the
       stack testable at http://${aws_lb.main.dns_name} right now.

    WAF is ${var.enable_waf ? "ENABLED, in COUNT mode - read sampled requests before switching to block" : "DISABLED (~$12/mo). Recommended before real traffic."}
  EOT
}

output "monthly_cost_note" {
  value = <<-EOT
    ALB ~$26 + ${var.asg_min_size} x ${var.instance_type} ~$${var.asg_min_size * 36}${var.enable_waf ? " + WAF ~$12" : ""}
    Running total across all stacks: ~$${129 + (var.asg_min_size - 1) * 36 + (var.enable_waf ? 12 : 0)}/month.

    To raise availability later, without a rebuild:
      asg_min_size = 2   # zero-downtime deploys, survives losing an instance
  EOT
}
