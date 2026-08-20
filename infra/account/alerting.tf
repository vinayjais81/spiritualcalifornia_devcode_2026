/**
 * Alert delivery + cost guardrails.
 *
 * The SNS topic created here is reused by the CloudWatch alarms that arrive
 * with P10, so production has one place alerts land rather than a per-service
 * scattering.
 */

resource "aws_sns_topic" "alerts" {
  name         = "sc-prod-alerts"
  display_name = "Spiritual California alerts"

  tags = {
    Name        = "sc-prod-alerts"
    Environment = "prod"
  }
}

/**
 * Email subscription.
 *
 * AWS sends a confirmation link that MUST be clicked. Until it is, the
 * subscription sits in "PendingConfirmation" and the topic delivers to
 * nobody — silently. Terraform reports success either way, so confirming is
 * a manual step that cannot be automated away.
 */
resource "aws_sns_topic_subscription" "alerts_email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

/**
 * Budget.
 *
 * Cost is an availability control, not just an accounting one: an unexpected
 * bill on a client's account is how environments get abruptly switched off.
 * Three thresholds — a warning, the line itself, and an overrun that means
 * something is genuinely wrong (a runaway ASG, an attack, a stuck job).
 *
 * FORECASTED at 100% catches a bad trend early in the month, when there is
 * still time to act.
 */
resource "aws_budgets_budget" "account" {
  name         = "sc-account-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.alert_email]
  }
}
