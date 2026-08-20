/**
 * sc-prod-vpc — the isolation boundary.
 *
 * Three tiers, two AZs:
 *   public       10.20.0.x   ALB + NAT. The only subnets with a route to the
 *                            internet gateway.
 *   private-app  10.20.1x.x  EC2. Outbound via NAT, no inbound from anywhere
 *                            but the ALB security group.
 *   private-data 10.20.2x.x  RDS + ElastiCache. NO default route at all —
 *                            the database has no business reaching the
 *                            internet, and not giving it a path is stronger
 *                            than any rule that says it must not.
 */

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "sc-prod-vpc" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = { Name = "sc-prod-igw" }
}

# ─── Subnets ─────────────────────────────────────────────────────────────────

resource "aws_subnet" "public" {
  for_each = { for i, az in var.azs : az => i }

  vpc_id            = aws_vpc.main.id
  availability_zone = each.key
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, each.value) # 10.20.0.0/24, 10.20.1.0/24

  # The ALB and the NAT need public addressing; nothing else lives here.
  map_public_ip_on_launch = true

  tags = {
    Name = "sc-prod-public-${each.key}"
    Tier = "public"
  }
}

resource "aws_subnet" "app" {
  for_each = { for i, az in var.azs : az => i }

  vpc_id            = aws_vpc.main.id
  availability_zone = each.key
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, each.value + 10) # 10.20.10.0/24, 10.20.11.0/24

  map_public_ip_on_launch = false

  tags = {
    Name = "sc-prod-app-${each.key}"
    Tier = "private-app"
  }
}

resource "aws_subnet" "data" {
  for_each = { for i, az in var.azs : az => i }

  vpc_id            = aws_vpc.main.id
  availability_zone = each.key
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, each.value + 20) # 10.20.20.0/24, 10.20.21.0/24

  map_public_ip_on_launch = false

  tags = {
    Name = "sc-prod-data-${each.key}"
    Tier = "private-data"
  }
}

# ─── Route tables ────────────────────────────────────────────────────────────

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "sc-prod-rt-public" }
}

resource "aws_route_table_association" "public" {
  for_each = aws_subnet.public

  subnet_id      = each.value.id
  route_table_id = aws_route_table.public.id
}

/**
 * One app route table per AZ.
 *
 * With a single NAT both tables point at the same target, so this looks like
 * needless duplication today. It is not: adding a second NAT for AZ
 * resilience later becomes "change one route" instead of "split the route
 * table while production is running through it".
 */
resource "aws_route_table" "app" {
  for_each = aws_subnet.app

  vpc_id = aws_vpc.main.id

  tags = {
    Name = "sc-prod-rt-app-${each.key}"
  }
}

resource "aws_route" "app_default" {
  for_each = aws_route_table.app

  route_table_id         = each.value.id
  destination_cidr_block = "0.0.0.0/0"

  # Exactly one of these is set; the other resolves to null and is ignored.
  nat_gateway_id       = var.use_nat_gateway ? aws_nat_gateway.main[0].id : null
  network_interface_id = var.use_nat_gateway ? null : aws_instance.nat[0].primary_network_interface_id
}

resource "aws_route_table_association" "app" {
  for_each = aws_subnet.app

  subnet_id      = each.value.id
  route_table_id = aws_route_table.app[each.key].id
}

/**
 * Data tier: no default route.
 *
 * RDS and ElastiCache never need to originate outbound traffic. Omitting the
 * route means an exfiltration attempt from a compromised database has
 * nowhere to send data, without depending on a security-group rule being
 * correct.
 */
resource "aws_route_table" "data" {
  vpc_id = aws_vpc.main.id

  tags = { Name = "sc-prod-rt-data" }
}

resource "aws_route_table_association" "data" {
  for_each = aws_subnet.data

  subnet_id      = each.value.id
  route_table_id = aws_route_table.data.id
}

# ─── S3 gateway endpoint ─────────────────────────────────────────────────────

/**
 * Free, and it pays for itself immediately: every credential document,
 * journal image and pre-signed upload would otherwise be billed as NAT data
 * processing on its way to S3. A gateway endpoint keeps that traffic inside
 * the VPC at no charge.
 *
 * Attached to the data route table too, so future RDS S3 exports do not need
 * a route to the internet.
 */
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.region}.s3"
  vpc_endpoint_type = "Gateway"

  route_table_ids = concat(
    [for rt in aws_route_table.app : rt.id],
    [aws_route_table.data.id],
  )

  tags = { Name = "sc-prod-vpce-s3" }
}

# ─── Flow logs ───────────────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "flow_logs" {
  name              = "/sc/prod/vpc-flow-logs"
  retention_in_days = 30

  tags = { Name = "sc-prod-flow-logs" }
}

resource "aws_iam_role" "flow_logs" {
  name = "sc-prod-flow-logs-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "vpc-flow-logs.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "flow_logs" {
  name = "sc-prod-flow-logs-policy"
  role = aws_iam_role.flow_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams",
      ]
      Resource = "${aws_cloudwatch_log_group.flow_logs.arn}:*"
    }]
  })
}

/**
 * REJECT traffic only.
 *
 * Logging everything on a busy VPC costs more than the NAT instance. Rejects
 * are the security-relevant subset — port scans, a misconfigured security
 * group, an instance trying to reach something it should not.
 */
resource "aws_flow_log" "main" {
  vpc_id          = aws_vpc.main.id
  traffic_type    = "REJECT"
  iam_role_arn    = aws_iam_role.flow_logs.arn
  log_destination = aws_cloudwatch_log_group.flow_logs.arn

  tags = { Name = "sc-prod-flow-log" }
}
