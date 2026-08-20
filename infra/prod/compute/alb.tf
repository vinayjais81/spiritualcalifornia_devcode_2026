/**
 * Application Load Balancer.
 *
 * Replaces the Nginx-on-the-box arrangement QA uses. TLS terminates off the
 * instance, each service is health-checked independently, instances become
 * replaceable, and scaling out later is a number rather than a rebuild.
 */

resource "aws_lb" "main" {
  name               = "sc-prod-alb"
  load_balancer_type = "application"
  internal           = false

  subnets         = data.terraform_remote_state.network.outputs.public_subnet_ids
  security_groups = [data.terraform_remote_state.network.outputs.alb_security_group_id]

  # Guide verification calls Textract and Claude synchronously in places; 60s
  # (the default) is close enough to those to be worth widening.
  idle_timeout = 120

  enable_http2                     = true
  enable_deletion_protection       = true
  enable_cross_zone_load_balancing = true

  # Rejects requests with malformed headers rather than passing them to the
  # app — closes a class of request-smuggling trick at the edge.
  drop_invalid_header_fields = true

  tags = { Name = "sc-prod-alb" }
}

# ─── Target groups ───────────────────────────────────────────────────────────

/**
 * Health check paths matter here.
 *
 * The web group checks /healthz — a static route that renders nothing.
 * Pointing it at "/" would cost a full React render of the home page on
 * every instance every 30 seconds, forever.
 *
 * The API group checks /api/v1/health/live — LIVENESS, deliberately not the
 * deep /api/v1/health. A deep check touching the database would mark every
 * instance unhealthy at the same moment during a database blip, and the ALB
 * has nowhere better to route: it would convert a slow database into a hard
 * outage. The deep endpoint exists for the deploy gate and monitoring.
 */
resource "aws_lb_target_group" "web" {
  name     = "sc-prod-web-tg"
  port     = var.app_port_web
  protocol = "HTTP"
  vpc_id   = data.terraform_remote_state.network.outputs.vpc_id

  # Drain in-flight requests before an instance leaves rotation.
  deregistration_delay = 60

  health_check {
    enabled             = true
    path                = "/healthz"
    protocol            = "HTTP"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200"
  }

  # Auth is a stateless JWT. Sticky sessions would pin users to instances for
  # no benefit and undermine even load distribution.
  stickiness {
    enabled = false
    type    = "lb_cookie"
  }

  tags = { Name = "sc-prod-web-tg" }
}

resource "aws_lb_target_group" "api" {
  name     = "sc-prod-api-tg"
  port     = var.app_port_api
  protocol = "HTTP"
  vpc_id   = data.terraform_remote_state.network.outputs.vpc_id

  deregistration_delay = 60

  health_check {
    enabled             = true
    path                = "/api/v1/health/live"
    protocol            = "HTTP"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200"
  }

  stickiness {
    enabled = false
    type    = "lb_cookie"
  }

  tags = { Name = "sc-prod-api-tg" }
}

# ─── Listeners ───────────────────────────────────────────────────────────────

locals {
  # Until P7 issues a certificate there is no HTTPS listener, so port 80 has
  # to serve traffic rather than redirect. That is what makes the stack
  # testable through the ALB's own DNS name before the domain exists.
  https_enabled = var.acm_certificate_arn != ""
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  dynamic "default_action" {
    for_each = local.https_enabled ? [1] : []
    content {
      type = "redirect"
      redirect {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }
  }

  dynamic "default_action" {
    for_each = local.https_enabled ? [] : [1]
    content {
      type             = "forward"
      target_group_arn = aws_lb_target_group.web.arn
    }
  }
}

resource "aws_lb_listener" "https" {
  count = local.https_enabled ? 1 : 0

  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }
}

# ─── Routing rules ───────────────────────────────────────────────────────────

/**
 * PRIORITY 10 — the rule this whole design hinges on.
 *
 * Next.js owns exactly one route under /api: the CMS revalidation webhook
 * the backend calls after every StaticPage change. Without an exact-match
 * rule ABOVE the /api/* rule, that call reaches NestJS, 404s, and every
 * admin edit to Terms / Privacy / Refund silently stops publishing.
 *
 * This is not a theoretical precaution. The identical bug was found live on
 * QA on 2026-08-20, where Nginx's `location /api/` had been swallowing the
 * webhook since the environment was built — CMS revalidation had never once
 * worked in a deployed environment.
 */
resource "aws_lb_listener_rule" "revalidate_http" {
  count = local.https_enabled ? 0 : 1

  listener_arn = aws_lb_listener.http.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }

  condition {
    path_pattern {
      values = ["/api/revalidate-static-page"]
    }
  }
}

resource "aws_lb_listener_rule" "api_http" {
  count = local.https_enabled ? 0 : 1

  listener_arn = aws_lb_listener.http.arn
  priority     = 20

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }
}

resource "aws_lb_listener_rule" "revalidate_https" {
  count = local.https_enabled ? 1 : 0

  listener_arn = aws_lb_listener.https[0].arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }

  condition {
    path_pattern {
      values = ["/api/revalidate-static-page"]
    }
  }
}

resource "aws_lb_listener_rule" "api_https" {
  count = local.https_enabled ? 1 : 0

  listener_arn = aws_lb_listener.https[0].arn
  priority     = 20

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }
}

# ─── Alarms ──────────────────────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  alarm_name          = "sc-prod-alb-5xx"
  alarm_description   = "The load balancer is returning 5xx. The site is broken for real users."
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_ELB_5XX_Count"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 10
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions    = { LoadBalancer = aws_lb.main.arn_suffix }
  alarm_actions = [data.aws_sns_topic.alerts.arn]

  tags = { Name = "sc-prod-alb-5xx-alarm" }
}

resource "aws_cloudwatch_metric_alarm" "unhealthy_hosts" {
  alarm_name          = "sc-prod-unhealthy-targets"
  alarm_description   = "An instance is failing health checks. At the launch tier of one instance, this means the site is down."
  namespace           = "AWS/ApplicationELB"
  metric_name         = "UnHealthyHostCount"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 5
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
    TargetGroup  = aws_lb_target_group.web.arn_suffix
  }

  alarm_actions = [data.aws_sns_topic.alerts.arn]

  tags = { Name = "sc-prod-unhealthy-alarm" }
}
