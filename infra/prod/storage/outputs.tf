output "uploads_bucket" {
  description = "Goes into AWS_S3_BUCKET."
  value       = aws_s3_bucket.uploads.id
}

output "cloudfront_url" {
  description = "Goes into AWS_CLOUDFRONT_URL. next.config.ts already allow-lists **.cloudfront.net, so no code change is needed."
  value       = "https://${aws_cloudfront_distribution.uploads.domain_name}"
}

output "cloudfront_distribution_id" {
  description = "Needed to issue cache invalidations."
  value       = aws_cloudfront_distribution.uploads.id
}

output "app_uploads_policy_arn" {
  description = "Attach to the EC2 instance profile in P6."
  value       = aws_iam_policy.app_uploads_access.arn
}

output "kms_key_arn" {
  value = aws_kms_key.uploads.arn
}

output "next_steps" {
  value = <<-EOT
    1. FILL IN THE TWO ENV PLACEHOLDERS.
       In /sc/prod/api/dotenv-template these were unknown until now:

         AWS_S3_BUCKET=${aws_s3_bucket.uploads.id}
         AWS_CLOUDFRONT_URL=https://${aws_cloudfront_distribution.uploads.domain_name}

    2. CORS IS SET FOR ${var.site_origin} ONLY.
       Uploads are a direct browser PUT, so testing from any other origin —
       a preview hostname before DNS cutover, for instance — fails with an
       opaque CORS error and no server-side trace. Add it to
       extra_cors_origins rather than debugging it.

    3. CLOUDFRONT TAKES 5-15 MINUTES TO DEPLOY.
       The distribution exists immediately but returns errors until its
       status reaches Deployed. Not a misconfiguration.

    4. Next: P5 (compose the real /sc/prod/api/dotenv) then P6 (ALB + ASG),
       which is where the site first becomes reachable.
  EOT
}

output "monthly_cost_note" {
  value = "S3 ~$5 + CloudFront ~$10 + KMS $1 = ~$16/month. Running total ~$67."
}
