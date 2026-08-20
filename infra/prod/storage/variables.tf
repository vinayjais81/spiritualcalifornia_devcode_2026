variable "region" {
  description = <<-EOT
    us-west-1, alongside the application.

    Note this deliberately differs from QA, whose document buckets sit in
    eu-north-1 — a running t3.medium in California reading uploads from
    Stockholm. Beyond the latency and cross-region transfer cost, keeping
    California practitioners' identity documents in California is the
    better answer to the CCPA question this marketplace has to be able to
    answer.
  EOT
  type        = string
  default     = "us-west-1"
}

variable "account_id" {
  type    = string
  default = "372110294387"
}

variable "site_origin" {
  description = <<-EOT
    The exact browser origin allowed to PUT directly to S3.

    Uploads go straight from the browser to S3 with a pre-signed URL, so if
    this does not match byte-for-byte, every upload fails with an opaque CORS
    error and no server-side log of what happened.
  EOT
  type        = string
  default     = "https://spiritualcalifornia.com"
}

variable "extra_cors_origins" {
  description = <<-EOT
    Additional origins permitted to upload — the temporary preview hostname
    used before DNS cutover, for instance. Empty for a normal production run.
  EOT
  type        = list(string)
  default     = []
}

variable "cloudfront_price_class" {
  description = <<-EOT
    PriceClass_100 serves from North America and Europe only, and is the
    cheapest tier. The audience is a California marketplace; paying to cache
    in Asia-Pacific and South America would buy nothing.
  EOT
  type        = string
  default     = "PriceClass_100"
}

variable "noncurrent_version_days" {
  description = "Days before a superseded object version moves to Glacier Instant Retrieval."
  type        = number
  default     = 90
}
