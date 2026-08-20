variable "region" {
  type    = string
  default = "us-west-1"
}

variable "account_id" {
  type    = string
  default = "372110294387"
}

variable "vpc_cidr" {
  description = <<-EOT
    Deliberately distinct from QA's default VPC (172.31.0.0/16) so the two
    ranges could never overlap. The VPCs are never peered — that is the
    single strongest isolation control available in a shared account — but
    non-overlapping CIDRs keep the option of a future migration open and make
    any accidental route obvious.
  EOT
  type        = string
  default     = "10.20.0.0/16"
}

variable "azs" {
  description = <<-EOT
    us-west-1 offers exactly these two AZs to this account.

    Subnets are created in BOTH from day one even though the launch tier runs
    a single instance in one of them. Subnets cost nothing, an RDS subnet
    group requires two AZs regardless, and provisioning them now is what
    makes "go Multi-AZ" a flag change later rather than a network rebuild
    performed on a live system.
  EOT
  type        = list(string)
  default     = ["us-west-1a", "us-west-1c"]
}

# ─── Cost / availability tier ────────────────────────────────────────────────

variable "use_nat_gateway" {
  description = <<-EOT
    false → a t4g.nano NAT *instance* (~$4/mo)
    true  → a managed NAT Gateway   (~$41/mo)

    The launch tier uses the instance. This is the single best cost trade in
    the whole build: it preserves the private-subnet posture — the thing
    least worth giving up — for a tenth of the price.

    What you accept: the NAT instance is a single point of failure for
    OUTBOUND traffic (Stripe, Resend, Anthropic, npm). Inbound traffic is
    unaffected, since that arrives via the ALB. It is also a host we patch
    rather than one AWS manages.

    Flip to true when outbound reliability starts carrying real money.
  EOT
  type        = bool
  default     = false
}

variable "nat_instance_type" {
  description = "ARM instance for the NAT. t4g.nano is ample — it forwards packets, nothing more."
  type        = string
  default     = "t4g.nano"
}

variable "enable_interface_endpoints" {
  description = <<-EOT
    Interface VPC endpoints for SSM, KMS, Secrets Manager and CloudWatch Logs.

    Left OFF at launch on cost grounds: they are ~$7/mo EACH, so the five the
    plan originally specified would add ~$35/mo — a quarter of the entire
    launch budget, to save a NAT instance costing $4.

    With them off, SSM Session Manager and the AWS SDKs reach AWS over the
    NAT instead. That works, and the traffic still never traverses the public
    internet unencrypted; it simply is not kept inside the VPC.

    Turn on when the budget widens, or when NAT data-processing charges make
    them cheaper than the alternative.
  EOT
  type        = bool
  default     = false
}
