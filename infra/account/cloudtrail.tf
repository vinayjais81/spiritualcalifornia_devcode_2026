/**
 * CloudTrail — the account's audit log.
 *
 * In a single-account setup this is the only record that can answer "did
 * something in QA touch production?" after the fact. Without it, a
 * cross-environment incident is unreconstructable: you would know the outcome
 * and have no way to establish the path.
 *
 * The first management-events trail per account is free; the cost here is S3
 * storage, a couple of dollars a month.
 */

resource "aws_s3_bucket" "logs" {
  bucket = "sc-audit-logs-${var.account_id}"

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Name        = "sc-audit-logs"
    Environment = "shared"
  }
}

resource "aws_s3_bucket_public_access_block" "logs" {
  bucket = aws_s3_bucket.logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Versioning plus a long retention: an attacker who gains write access should
# not be able to quietly erase the record of how they got in.
resource "aws_s3_bucket_versioning" "logs" {
  bucket = aws_s3_bucket.logs.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    id     = "archive-then-expire"
    status = "Enabled"

    filter {}

    transition {
      days          = 90
      storage_class = "GLACIER_IR"
    }

    expiration {
      days = var.log_retention_days
    }

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

# CloudTrail writes to the bucket as a service principal, so the bucket policy
# has to grant it explicitly — an IAM role on our side cannot substitute.
data "aws_iam_policy_document" "logs_bucket" {
  statement {
    sid    = "AWSCloudTrailAclCheck"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["cloudtrail.amazonaws.com"]
    }

    actions   = ["s3:GetBucketAcl"]
    resources = [aws_s3_bucket.logs.arn]

    condition {
      test     = "StringEquals"
      variable = "aws:SourceArn"
      values   = ["arn:aws:cloudtrail:${var.region}:${var.account_id}:trail/sc-account-trail"]
    }
  }

  statement {
    sid    = "AWSCloudTrailWrite"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["cloudtrail.amazonaws.com"]
    }

    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.logs.arn}/AWSLogs/${var.account_id}/*"]

    condition {
      test     = "StringEquals"
      variable = "s3:x-amz-acl"
      values   = ["bucket-owner-full-control"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceArn"
      values   = ["arn:aws:cloudtrail:${var.region}:${var.account_id}:trail/sc-account-trail"]
    }
  }

  # Belt and braces: refuse anything not using TLS.
  statement {
    sid    = "DenyInsecureTransport"
    effect = "Deny"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions   = ["s3:*"]
    resources = [aws_s3_bucket.logs.arn, "${aws_s3_bucket.logs.arn}/*"]

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "logs" {
  bucket = aws_s3_bucket.logs.id
  policy = data.aws_iam_policy_document.logs_bucket.json
}

resource "aws_cloudtrail" "account" {
  name           = "sc-account-trail"
  s3_bucket_name = aws_s3_bucket.logs.id

  # Capture activity in every region, not just us-west-1. Someone spinning up
  # instances in an unused region is exactly the signal worth catching, and
  # it is invisible to a single-region trail.
  is_multi_region_trail = true

  include_global_service_events = true

  # Detects tampering with the log files themselves.
  enable_log_file_validation = true

  tags = {
    Name        = "sc-account-trail"
    Environment = "shared"
  }

  depends_on = [aws_s3_bucket_policy.logs]
}
