variable "region" {
  type    = string
  default = "us-west-1"
}

variable "account_id" {
  type    = string
  default = "372110294387"
}

variable "instance_type" {
  description = <<-EOT
    t3.medium (2 vCPU / 4 GB, ~$36/mo).

    Sized by the BUILD, not by serving. `next build` is memory-hungry and the
    deploy runs it on the instance; 2 GB (t3.small) risks an OOM that
    presents as a mysteriously failed deploy. Serving this app's traffic
    needs far less.

    That coupling disappears once P-2 phase work moves to build-once /
    ship-artifact, at which point t3.small becomes viable and halves this line.
  EOT
  type        = string
  default     = "t3.medium"
}

variable "asg_min_size" {
  description = <<-EOT
    1 at launch (~$36/mo). 2 gives zero-downtime deploys and survives losing
    an instance (~$72/mo).

    What 1 costs you: every deploy has a brief gap while PM2 restarts, and an
    instance failure is ~5 minutes of downtime while the ASG replaces it.
    Both are self-healing; neither is invisible.
  EOT
  type        = number
  default     = 1
}

variable "asg_max_size" {
  description = "Headroom for an instance refresh to bring up a replacement before removing the old one."
  type        = number
  default     = 2
}

variable "health_check_type" {
  description = <<-EOT
    "EC2" until the first successful deploy, then "ELB".

    This ordering is deliberate. With ELB checks, a freshly launched instance
    that has no application code yet fails its check, gets terminated, is
    replaced, and the ASG loops forever burning instances. EC2 checks only
    ask whether the machine is alive.

    FLIPPED TO "ELB" on 2026-08-21, once the first deploy succeeded and both
    target groups reported healthy. That is what makes a hung Node process
    count as unhealthy rather than merely a stopped instance.

    Only set this back to "EC2" if the environment is ever rebuilt from
    scratch, where instances again exist before any code does.
  EOT
  type        = string
  default     = "ELB"
}

variable "acm_certificate_arn" {
  description = <<-EOT
    Empty until P7 issues the certificate.

    While empty, only an HTTP listener is created — which is what lets the
    whole stack be tested through the ALB's own DNS name before the domain
    exists. Set it and re-apply to add the HTTPS listener and the HTTP to
    HTTPS redirect.

    A certificate cannot be issued earlier: ACM validates via DNS, and the
    hosted zone does not exist until P7.
  EOT
  type        = string
  default     = ""
}

variable "enable_waf" {
  description = <<-EOT
    AWS WAF on the ALB: managed rule sets plus a rate limit. ~$12/month,
    which sits outside the $135 launch tier — hence off by default.

    RECOMMENDED BEFORE REAL TRAFFIC. When enabled, start it in COUNT mode
    (see waf.tf) for 48 hours and read the sampled requests before switching
    to block: the managed rules will otherwise flag legitimate rich-text
    admin submissions, and the rate rule would throttle Stripe's bursty
    webhook retries.
  EOT
  type        = bool
  default     = false
}

variable "site_domain" {
  description = <<-EOT
    The canonical hostname the site serves from.

    www redirects here rather than serving, because production CORS permits
    exactly one origin — if www served the site, every browser-side API call
    from it would fail CORS while the page itself rendered fine.
  EOT
  type        = string
  default     = "spiritualcalifornia.com"
}

variable "app_port_web" {
  type    = number
  default = 3000
}

variable "app_port_api" {
  type    = number
  default = 3001
}
