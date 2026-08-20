/**
 * sc-prod-uploads — guide identity documents, credential certificates,
 * journal imagery, product media.
 *
 * Fully private. Two read paths, both authorised rather than public:
 *   - CloudFront + Origin Access Control, for media the site displays
 *   - Pre-signed S3 URLs issued by the API, for sensitive documents
 *
 * The write path is the browser PUTting directly to S3 with a pre-signed
 * URL, which is why the CORS rule below is load-bearing.
 */

resource "aws_s3_bucket" "uploads" {
  bucket = "sc-prod-uploads-${var.account_id}"

  lifecycle {
    prevent_destroy = true
  }

  tags = { Name = "sc-prod-uploads" }
}

# Four flags, all on. Nothing in this bucket is ever public.
resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.uploads.arn
    }

    # Encrypt with one data key per bucket rather than per object. Cuts KMS
    # API calls — and therefore KMS charges — substantially on a bucket that
    # serves many small files.
    bucket_key_enabled = true
  }
}

/**
 * Versioning.
 *
 * The uploads here are evidence: a credential certificate an admin approved
 * a guide against, an identity document tied to a verification decision. If
 * one is overwritten or deleted, the previous version is what lets you
 * reconstruct what was actually reviewed.
 */
resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  versioning_configuration {
    status = "Enabled"
  }
}

/**
 * CORS — the browser PUTs here directly with a pre-signed URL.
 *
 * If `site_origin` is not byte-exact, every upload fails with an opaque
 * browser CORS error and nothing server-side records why. This is a known
 * failure mode on this project: credential uploads silently no-op'd once
 * before for a related reason.
 *
 * ETag is exposed because multipart uploads need to read it back.
 */
resource "aws_s3_bucket_cors_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "HEAD"]
    allowed_origins = concat([var.site_origin], var.extra_cors_origins)
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  # A browser upload abandoned halfway leaves parts that are billed but
  # invisible in the console. Without this they accumulate forever.
  rule {
    id     = "abort-incomplete-uploads"
    status = "Enabled"

    filter {}

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }

  # Old versions are kept for the audit reason above, but they do not need to
  # sit in Standard storage. Glacier IR is ~4x cheaper with millisecond
  # retrieval, so recovering one is still immediate.
  rule {
    id     = "archive-old-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_transition {
      noncurrent_days = var.noncurrent_version_days
      storage_class   = "GLACIER_IR"
    }
  }
}

/**
 * Bucket policy: CloudFront may read, and nobody may connect without TLS.
 *
 * Note the SourceArn condition names the distribution exactly. Without it,
 * ANY CloudFront distribution in ANY account could be pointed at this bucket
 * and would be allowed to read it — the confused-deputy problem that Origin
 * Access Control exists to solve.
 */
data "aws_iam_policy_document" "uploads" {
  statement {
    sid    = "AllowCloudFrontRead"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.uploads.arn}/*"]

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.uploads.arn]
    }
  }

  statement {
    sid    = "DenyInsecureTransport"
    effect = "Deny"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.uploads.arn,
      "${aws_s3_bucket.uploads.arn}/*",
    ]

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  policy = data.aws_iam_policy_document.uploads.json
}
