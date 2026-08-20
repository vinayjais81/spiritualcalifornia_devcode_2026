/**
 * AWS WAF — off by default at the launch tier (~$12/mo).
 *
 * Enable with enable_waf = true, and read the note in variables.tf first:
 * every rule below starts in COUNT mode. Switching straight to block would
 * flag legitimate rich-text admin submissions and, worse, throttle Stripe's
 * bursty webhook retries — a blocked webhook is a payment that never
 * reconciles.
 */

resource "aws_wafv2_web_acl" "main" {
  count = var.enable_waf ? 1 : 0

  name        = "sc-prod-waf"
  description = "Managed rule sets plus a rate limit, in front of the ALB."
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1

    # COUNT while tuning. SizeRestrictions_BODY in particular will flag
    # Tiptap rich-text submissions from the admin editor.
    override_action {
      count {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesCommonRuleSet"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "sc-prod-common-rules"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 2

    override_action {
      count {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "sc-prod-bad-inputs"
      sampled_requests_enabled   = true
    }
  }

  /**
   * Rate limit, with the webhook paths excluded.
   *
   * Stripe retries aggressively and in bursts; so does Resend. Rate-limiting
   * a payment webhook produces a charge that captured but never reconciled
   * into an order — the worst possible failure mode for this application,
   * and one that would look like a bug in the checkout code.
   */
  rule {
    name     = "RateLimitPerIp"
    priority = 10

    action {
      count {}
    }

    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"

        scope_down_statement {
          not_statement {
            statement {
              or_statement {
                statement {
                  byte_match_statement {
                    search_string         = "/api/v1/payments/webhook"
                    positional_constraint = "STARTS_WITH"
                    field_to_match {
                      uri_path {}
                    }
                    text_transformation {
                      priority = 0
                      type     = "LOWERCASE"
                    }
                  }
                }
                statement {
                  byte_match_statement {
                    search_string         = "/api/v1/verification/stripe-identity/webhook"
                    positional_constraint = "STARTS_WITH"
                    field_to_match {
                      uri_path {}
                    }
                    text_transformation {
                      priority = 0
                      type     = "LOWERCASE"
                    }
                  }
                }
                statement {
                  byte_match_statement {
                    search_string         = "/api/v1/invites/webhook"
                    positional_constraint = "STARTS_WITH"
                    field_to_match {
                      uri_path {}
                    }
                    text_transformation {
                      priority = 0
                      type     = "LOWERCASE"
                    }
                  }
                }
                statement {
                  byte_match_statement {
                    search_string         = "/api/v1/calendly/webhook"
                    positional_constraint = "STARTS_WITH"
                    field_to_match {
                      uri_path {}
                    }
                    text_transformation {
                      priority = 0
                      type     = "LOWERCASE"
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "sc-prod-rate-limit"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "sc-prod-waf"
    sampled_requests_enabled   = true
  }

  tags = { Name = "sc-prod-waf" }
}

resource "aws_wafv2_web_acl_association" "main" {
  count = var.enable_waf ? 1 : 0

  resource_arn = aws_lb.main.arn
  web_acl_arn  = aws_wafv2_web_acl.main[0].arn
}
