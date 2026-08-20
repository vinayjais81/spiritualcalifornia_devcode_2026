/**
 * CloudFront in front of the uploads bucket.
 *
 * Origin Access Control rather than the legacy Origin Access Identity: OAI
 * cannot sign requests to a bucket encrypted with a customer-managed KMS
 * key, which this one is. OAC signs with SigV4 and can.
 *
 * No custom domain at launch. A `cdn.spiritualcalifornia.com` alias would
 * need an ACM certificate in us-east-1 (CloudFront accepts certificates from
 * that region only, regardless of where the distribution serves), and
 * next.config.ts already allow-lists `**.cloudfront.net` — so the default
 * domain works with no code change, and a custom one would need one.
 */

resource "aws_cloudfront_origin_access_control" "uploads" {
  name                              = "sc-prod-uploads-oac"
  description                       = "Signs CloudFront requests to the private uploads bucket."
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

/**
 * Cache policy.
 *
 * Uploaded objects are immutable in practice — a new image is a new key —
 * so they cache for a day by default and up to a year. Compression is on for
 * the text-ish assets that pass through.
 *
 * Deliberately forwards no cookies and no query strings: nothing here varies
 * by user, and forwarding them would fragment the cache and leak session
 * data to the edge for no benefit.
 */
resource "aws_cloudfront_cache_policy" "uploads" {
  name        = "sc-prod-uploads-cache-policy"
  comment     = "Long-lived caching for immutable uploaded media."
  default_ttl = 86400
  min_ttl     = 0
  max_ttl     = 31536000

  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_gzip   = true
    enable_accept_encoding_brotli = true

    cookies_config {
      cookie_behavior = "none"
    }

    headers_config {
      header_behavior = "none"
    }

    query_strings_config {
      query_string_behavior = "none"
    }
  }
}

resource "aws_cloudfront_distribution" "uploads" {
  enabled     = true
  comment     = "Spiritual California production uploads"
  price_class = var.cloudfront_price_class

  # IPv6 costs nothing and a meaningful share of mobile traffic prefers it.
  is_ipv6_enabled = true

  origin {
    domain_name              = aws_s3_bucket.uploads.bucket_regional_domain_name
    origin_id                = "s3-uploads"
    origin_access_control_id = aws_cloudfront_origin_access_control.uploads.id
  }

  default_cache_behavior {
    target_origin_id = "s3-uploads"

    # Read-only. The write path is a pre-signed PUT straight to S3, so
    # CloudFront never needs to accept anything but GET and HEAD.
    allowed_methods = ["GET", "HEAD"]
    cached_methods  = ["GET", "HEAD"]

    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    cache_policy_id        = aws_cloudfront_cache_policy.uploads.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    # The default *.cloudfront.net certificate. Replace with acm_certificate_arn
    # (issued in us-east-1) when a custom CDN domain is added.
    cloudfront_default_certificate = true
    minimum_protocol_version       = "TLSv1.2_2021"
  }

  tags = { Name = "sc-prod-uploads-cdn" }
}
