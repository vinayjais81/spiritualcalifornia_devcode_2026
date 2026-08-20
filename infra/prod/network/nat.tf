/**
 * Outbound internet for the private app subnets.
 *
 * Two implementations behind one variable. The launch tier uses the
 * instance; `use_nat_gateway = true` switches to the managed service without
 * touching anything else, because the route in vpc.tf already selects
 * between them.
 *
 *   NAT instance (t4g.nano) : ~$4/mo   — a host we own and patch
 *   NAT Gateway             : ~$41/mo  — managed, AZ-redundant within its AZ
 *
 * The instance is a single point of failure for OUTBOUND traffic only:
 * Stripe API calls, Resend email, Anthropic, npm during a deploy. Inbound
 * traffic arrives through the ALB and is unaffected, so the site keeps
 * serving pages if the NAT dies — payments are what break.
 */

# ─── Option A: NAT instance (launch tier) ────────────────────────────────────

# Amazon Linux 2023, arm64, resolved at plan time rather than pinned by hand.
data "aws_ssm_parameter" "al2023_arm64" {
  count = var.use_nat_gateway ? 0 : 1
  name  = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64"
}

resource "aws_security_group" "nat" {
  count = var.use_nat_gateway ? 0 : 1

  name        = "sc-prod-nat-sg"
  description = "NAT instance - forwards outbound traffic from the app subnets."
  vpc_id      = aws_vpc.main.id

  # Only the VPC itself may route through it. Not the internet.
  ingress {
    description = "Any traffic originating inside the VPC"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    description = "Outbound to anywhere - this is the point of the host"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "sc-prod-nat-sg" }
}

resource "aws_instance" "nat" {
  count = var.use_nat_gateway ? 0 : 1

  ami                    = data.aws_ssm_parameter.al2023_arm64[0].value
  instance_type          = var.nat_instance_type
  subnet_id              = aws_subnet.public[var.azs[0]].id
  vpc_security_group_ids = [aws_security_group.nat[0].id]

  /**
   * The setting that makes this a NAT at all.
   *
   * EC2 normally drops packets whose source or destination is not the
   * instance itself. A NAT exists precisely to forward other hosts' packets,
   * so that check has to be off. Miss this and everything looks correct
   * while nothing routes.
   */
  source_dest_check = false

  # Instance-store-free, minimal disk; this host stores nothing.
  root_block_device {
    volume_size = 8
    volume_type = "gp3"
    encrypted   = true
  }

  metadata_options {
    http_tokens   = "required" # IMDSv2, closing the SSRF credential path
    http_endpoint = "enabled"
  }

  user_data = <<-EOF
    #!/bin/bash
    set -euxo pipefail

    # Forward packets between interfaces, and survive reboots.
    echo 'net.ipv4.ip_forward = 1' > /etc/sysctl.d/99-nat.conf
    sysctl -p /etc/sysctl.d/99-nat.conf

    # Masquerade traffic from the VPC out of the primary interface. Written
    # as a unit rather than a one-off command so it re-applies on boot —
    # otherwise a reboot silently takes production's outbound traffic down.
    IFACE=$(ip route show default | awk '{print $5; exit}')
    dnf install -y iptables-services
    iptables -t nat -A POSTROUTING -o "$IFACE" -s ${var.vpc_cidr} -j MASQUERADE
    iptables -F FORWARD
    service iptables save
    systemctl enable --now iptables
  EOF

  # Replace the instance when the bootstrap changes, rather than leaving a
  # host running configuration that no longer matches the code.
  user_data_replace_on_change = true

  tags = { Name = "sc-prod-nat" }
}

/**
 * Static address, so the NAT's public IP survives a stop/start.
 *
 * This matters beyond convenience: outbound calls to Stripe and Resend leave
 * from here, and a stable egress IP is what makes those addresses
 * allow-listable if a provider ever requires it.
 */
resource "aws_eip" "nat_instance" {
  count = var.use_nat_gateway ? 0 : 1

  instance = aws_instance.nat[0].id
  domain   = "vpc"

  tags = { Name = "sc-prod-nat-eip" }

  depends_on = [aws_internet_gateway.main]
}

/**
 * The NAT is a single point of failure, so it is monitored rather than
 * merely hoped for. A failed status check means outbound traffic has stopped
 * — payments included — and the fix is to replace the instance.
 */
resource "aws_cloudwatch_metric_alarm" "nat_instance_health" {
  count = var.use_nat_gateway ? 0 : 1

  alarm_name          = "sc-prod-nat-instance-unhealthy"
  alarm_description   = "NAT instance failed its status check. Outbound traffic (Stripe, Resend) is down."
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 2
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "breaching"

  dimensions = {
    InstanceId = aws_instance.nat[0].id
  }

  # Recover the instance on underlying-hardware failure without waiting for
  # a human. Does not help if the OS itself wedges.
  alarm_actions = [
    "arn:aws:automate:${var.region}:ec2:recover",
  ]

  tags = { Name = "sc-prod-nat-alarm" }
}

# ─── Option B: managed NAT Gateway ───────────────────────────────────────────

resource "aws_eip" "nat_gateway" {
  count = var.use_nat_gateway ? 1 : 0

  domain = "vpc"
  tags   = { Name = "sc-prod-nat-gw-eip" }

  depends_on = [aws_internet_gateway.main]
}

resource "aws_nat_gateway" "main" {
  count = var.use_nat_gateway ? 1 : 0

  allocation_id = aws_eip.nat_gateway[0].id
  subnet_id     = aws_subnet.public[var.azs[0]].id

  tags = { Name = "sc-prod-nat-gw" }

  depends_on = [aws_internet_gateway.main]
}
