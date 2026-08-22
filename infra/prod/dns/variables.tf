variable "region" {
  type    = string
  default = "us-west-1"
}

variable "account_id" {
  type    = string
  default = "372110294387"
}

variable "domain" {
  type    = string
  default = "spiritualcalifornia.com"
}

variable "wait_for_certificate" {
  description = <<-EOT
    Whether to block the apply until ACM has issued the certificate.

    FALSE for the first apply. The certificate cannot validate until the
    nameservers point at this zone, and the domain is still served by GoDaddy
    at that point - so waiting would simply time out after 45 minutes.

    Sequence:
      1. apply with false            -> creates the zone, prints the nameservers
      2. delegate at GoDaddy          -> the client's two-minute step
      3. apply with true              -> validation completes, certificate issues
      4. set acm_certificate_arn in the compute stack and apply -> HTTPS live
  EOT
  type        = bool
  default     = false
}
