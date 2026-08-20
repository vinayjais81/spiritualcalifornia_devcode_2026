/**
 * Launch template + Auto Scaling group.
 *
 * Even at one instance, the ASG earns its place: an instance that dies is
 * replaced automatically rather than at 3am by a human, and going to two is
 * a number change. A bare EC2 instance would give neither.
 */

# Ubuntu 24.04 LTS, resolved rather than hardcoded. Canonical's account id is
# fixed and well known; owner filtering is what stops a lookalike AMI from a
# stranger's account ever matching.
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_launch_template" "app" {
  name_prefix   = "sc-prod-app-"
  image_id      = data.aws_ami.ubuntu.id
  instance_type = var.instance_type

  iam_instance_profile {
    arn = aws_iam_instance_profile.app.arn
  }

  vpc_security_group_ids = [data.terraform_remote_state.network.outputs.app_security_group_id]

  # No key_name. There is no SSH port on the security group and no key pair
  # anywhere — access is SSM Session Manager, which leaves nothing to leak.

  block_device_mappings {
    device_name = "/dev/sda1"

    ebs {
      volume_size           = 40
      volume_type           = "gp3"
      encrypted             = true
      delete_on_termination = true
    }
  }

  metadata_options {
    # IMDSv2 required. This is the control that stops a server-side request
    # forgery in the app from being escalated into stealing the instance
    # role's credentials.
    http_tokens                 = "required"
    http_endpoint               = "enabled"
    http_put_response_hop_limit = 1
    instance_metadata_tags      = "enabled"
  }

  monitoring {
    enabled = true
  }

  user_data = base64encode(templatefile("${path.module}/userdata.sh", {
    app_dir = "/var/www/spiritual-california"
  }))

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name = "sc-prod-app"
      # Environment=prod is what the deploy role's ssm:SendCommand condition
      # matches on. An untagged instance cannot be deployed to.
      Environment = "prod"
    }
  }

  tag_specifications {
    resource_type = "volume"
    tags = {
      Name        = "sc-prod-app-volume"
      Environment = "prod"
    }
  }

  # Replacing the template rather than mutating it keeps a rollback target.
  lifecycle {
    create_before_destroy = true
  }

  tags = { Name = "sc-prod-app-lt" }
}

resource "aws_autoscaling_group" "app" {
  name = "sc-prod-app-asg"

  min_size         = var.asg_min_size
  max_size         = var.asg_max_size
  desired_capacity = var.asg_min_size

  # Both private app subnets, even running one instance. A replacement can
  # then land in whichever AZ is healthy, and raising desired_capacity
  # spreads across AZs without touching the network.
  vpc_zone_identifier = data.terraform_remote_state.network.outputs.app_subnet_ids

  target_group_arns = [
    aws_lb_target_group.web.arn,
    aws_lb_target_group.api.arn,
  ]

  # EC2 until the first deploy, then ELB. See variables.tf — with ELB checks,
  # an instance with no code yet fails, is replaced, and the group loops.
  health_check_type = var.health_check_type

  # Long enough for apt, Node, and the CloudWatch agent to install before the
  # instance is judged.
  health_check_grace_period = 600

  launch_template {
    id      = aws_launch_template.app.id
    version = "$Latest"
  }

  # Replace the oldest first, so a rollout drains the previous generation.
  termination_policies = ["OldestInstance"]

  instance_refresh {
    strategy = "Rolling"
    preferences {
      # At min_size 1 this permits a brief single-instance gap; at 2 or more
      # it keeps half the fleet serving throughout.
      min_healthy_percentage = 50
      instance_warmup        = 600
    }
  }

  tag {
    key                 = "Name"
    value               = "sc-prod-app"
    propagate_at_launch = true
  }

  tag {
    key                 = "Environment"
    value               = "prod"
    propagate_at_launch = true
  }

  lifecycle {
    # desired_capacity drifts as scaling acts; Terraform should not keep
    # pulling it back to min_size on every apply.
    ignore_changes = [desired_capacity]
  }
}

/**
 * Redundancy alarm.
 *
 * At the launch tier this fires whenever the single instance is gone —
 * which is precisely when someone needs to know. Once min_size goes to 2 it
 * becomes the "lost redundancy" signal instead, without needing a change.
 */
resource "aws_cloudwatch_metric_alarm" "asg_capacity" {
  alarm_name          = "sc-prod-asg-below-capacity"
  alarm_description   = "Fewer instances in service than expected. At one instance, the site is down."
  namespace           = "AWS/AutoScaling"
  metric_name         = "GroupInServiceInstances"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = var.asg_min_size
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "breaching"

  dimensions    = { AutoScalingGroupName = aws_autoscaling_group.app.name }
  alarm_actions = [data.aws_sns_topic.alerts.arn]

  tags = { Name = "sc-prod-asg-capacity-alarm" }
}

resource "aws_cloudwatch_metric_alarm" "instance_memory" {
  alarm_name          = "sc-prod-instance-memory-high"
  alarm_description   = "Instance memory above 85%. next build is the usual cause; a deploy may be about to OOM."
  namespace           = "SpiritualCalifornia/Prod"
  metric_name         = "mem_used_percent"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = 85
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "missing"

  alarm_actions = [data.aws_sns_topic.alerts.arn]

  tags = { Name = "sc-prod-memory-alarm" }
}
