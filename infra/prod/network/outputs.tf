output "vpc_id" {
  value = aws_vpc.main.id
}

output "vpc_cidr" {
  value = aws_vpc.main.cidr_block
}

output "public_subnet_ids" {
  description = "ALB and NAT live here."
  value       = [for s in aws_subnet.public : s.id]
}

output "app_subnet_ids" {
  description = "EC2 / Auto Scaling Group."
  value       = [for s in aws_subnet.app : s.id]
}

output "data_subnet_ids" {
  description = "RDS and ElastiCache subnet groups. Two AZs even at launch, so Multi-AZ is later a flag rather than a rebuild."
  value       = [for s in aws_subnet.data : s.id]
}

output "alb_security_group_id" {
  value = aws_security_group.alb.id
}

output "app_security_group_id" {
  value = aws_security_group.app.id
}

output "rds_security_group_id" {
  value = aws_security_group.rds.id
}

output "redis_security_group_id" {
  value = aws_security_group.redis.id
}

output "nat_public_ip" {
  description = <<-EOT
    Production's egress address — every outbound call to Stripe, Resend and
    Anthropic leaves from here. Worth recording: some providers allow-list by
    source IP, and this address is stable across a stop/start.
  EOT
  value       = var.use_nat_gateway ? try(aws_eip.nat_gateway[0].public_ip, "") : try(aws_eip.nat_instance[0].public_ip, "")
}

output "monthly_cost_note" {
  value = <<-EOT
    Launch tier. NAT = ${var.use_nat_gateway ? "Gateway (~$41/mo)" : "t4g.nano instance (~$4/mo)"}.
    Interface endpoints ${var.enable_interface_endpoints ? "ON (~$42/mo)" : "OFF (saves ~$42/mo; SSM reaches AWS via NAT)"}.

    To scale up later, without a rebuild:
      use_nat_gateway            = true
      enable_interface_endpoints = true
  EOT
}
