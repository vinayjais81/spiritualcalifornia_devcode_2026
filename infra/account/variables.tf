variable "region" {
  description = "AWS region for production. us-west-1 matches QA — see decision D1 in the deployment plan."
  type        = string
  default     = "us-west-1"
}

variable "account_id" {
  description = "The client AWS account. Terraform refuses to run against any other."
  type        = string
  default     = "372110294387"
}

# ─── GitHub OIDC ─────────────────────────────────────────────────────────────

variable "github_org" {
  description = "GitHub org/user that owns the deploy repository."
  type        = string
  default     = "vinayjais81"
}

variable "github_repo" {
  description = "Repository allowed to assume the production deploy role."
  type        = string
  default     = "spiritualcalifornia_devcode_2026"
}

variable "github_environment" {
  description = <<-EOT
    GitHub Environment the deploy role is scoped to. The trust policy pins
    `sub` to `repo:<org>/<repo>:environment:<this>`, so only a workflow job
    running in this protected environment can assume the role — a push to a
    branch cannot. Create it in GitHub with required reviewers.
  EOT
  type        = string
  default     = "production"
}

# ─── Alerting ────────────────────────────────────────────────────────────────

variable "alert_email" {
  description = <<-EOT
    Address that receives budget, GuardDuty and (later) CloudWatch alarms.
    AWS sends a subscription confirmation that MUST be clicked, or the topic
    silently delivers to nobody.
  EOT
  type        = string
  default     = "vinay.jaiswal@nityo.com"
}

variable "monthly_budget_usd" {
  description = <<-EOT
    Total account budget, in USD.

    Set to track ACTUAL expected spend, not the eventual ceiling. A budget
    far above real usage never fires, which makes it decoration rather than a
    control.

    Measured 2026-08-20: the account bills ~$0/month — it is standalone (no
    Organization) and credits or free tier are currently offsetting usage, to
    the point that a running t3.medium produces no EC2 compute line at all.
    That is precisely why the figure should stay low: when the credits are
    exhausted, spend will not creep upward, it will step up in one month, and
    a high budget would not notice.

    At 100, the 80% threshold fires at $80 — early enough that a forgotten
    NAT gateway or an oversized instance is caught while it is still cheap.

    RAISE THIS DELIBERATELY as production comes online (~$340-400/mo
    estimated in §11), as a step in the P13 cutover rather than a surprise.
  EOT
  type        = number
  default     = 100
}

# ─── Optional, billable services ─────────────────────────────────────────────

variable "enable_guardduty" {
  description = <<-EOT
    Threat detection: credential exfiltration, crypto-mining, contact with
    known-bad IPs. ~$10-30/mo. This is the only control here that detects a
    COMPROMISED INSTANCE, which is the scenario a shared-account setup is
    most exposed to. Recommended on.
  EOT
  type        = bool
  default     = true
}

variable "enable_config" {
  description = <<-EOT
    AWS Config: records resource configuration over time and evaluates
    compliance rules — including `required-tags`, which is what stops an
    untagged resource silently sitting outside the isolation policy.
    ~$2-10/mo depending on resource count.
  EOT
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "Retention for the CloudTrail S3 objects before they expire."
  type        = number
  default     = 400
}
