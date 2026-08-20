/**
 * Security groups.
 *
 * The rule that makes these an isolation boundary rather than decoration:
 * every source is ANOTHER SECURITY GROUP, never a CIDR range. A CIDR can be
 * widened later by someone in a hurry and nothing objects; a security-group
 * reference cannot be widened without creating a new group, which is
 * visible in a plan.
 *
 * The one exception is the ALB, which by definition accepts the internet.
 */

resource "aws_security_group" "alb" {
  name        = "sc-prod-alb-sg"
  description = "Public entry point. The only group that accepts traffic from the internet."
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP - redirected to HTTPS at the listener, never served"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "To the app instances"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [var.vpc_cidr]
  }

  tags = { Name = "sc-prod-alb-sg" }
}

/**
 * App instances.
 *
 * Note what is absent: there is NO rule for port 22, in any form. Operator
 * access is SSM Session Manager, which needs no inbound rule at all, leaves
 * no key to leak, and records every session in CloudTrail. QA's open SSH
 * port is exactly the weakness this design removes.
 */
resource "aws_security_group" "app" {
  name        = "sc-prod-app-sg"
  description = "Next.js (3000) and NestJS (3001). Reachable only from the ALB."
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Next.js from the ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    description     = "NestJS from the ALB"
    from_port       = 3001
    to_port         = 3001
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # Outbound is open: the app calls Stripe, Resend, Anthropic, Zoom, Calendly
  # and npm during a deploy. Restricting this to an IP allow-list breaks the
  # moment any of those providers rotates their ranges.
  egress {
    description = "Third-party APIs and package registries via NAT"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "sc-prod-app-sg" }
}

resource "aws_security_group" "rds" {
  name        = "sc-prod-rds-sg"
  description = "PostgreSQL. Reachable only from the app instances."
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from the app tier"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  # Deliberately no egress rule. The database originates nothing, and the
  # data subnets have no default route either — two independent reasons an
  # exfiltration attempt from here has nowhere to go.

  tags = { Name = "sc-prod-rds-sg" }
}

resource "aws_security_group" "redis" {
  name        = "sc-prod-redis-sg"
  description = "ElastiCache. Reachable only from the app instances."
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Redis from the app tier"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  tags = { Name = "sc-prod-redis-sg" }
}

# ─── Interface endpoints (off at launch — see variables.tf) ──────────────────

resource "aws_security_group" "vpce" {
  count = var.enable_interface_endpoints ? 1 : 0

  name        = "sc-prod-vpce-sg"
  description = "Interface VPC endpoints, reachable from the app tier."
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "HTTPS from the app tier"
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  tags = { Name = "sc-prod-vpce-sg" }
}

resource "aws_vpc_endpoint" "interface" {
  for_each = var.enable_interface_endpoints ? toset([
    "ssm", "ssmmessages", "ec2messages", "kms", "logs", "secretsmanager",
  ]) : toset([])

  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.region}.${each.key}"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = [for s in aws_subnet.app : s.id]
  security_group_ids  = [aws_security_group.vpce[0].id]
  private_dns_enabled = true

  tags = { Name = "sc-prod-vpce-${each.key}" }
}
