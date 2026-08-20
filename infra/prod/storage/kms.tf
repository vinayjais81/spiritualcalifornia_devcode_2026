/**
 * Encryption key for the uploads bucket.
 *
 * A separate key from the data tier's, deliberately: different blast radius,
 * different principals. The RDS key is used by database services; this one is
 * used by CloudFront and the application instances. Sharing one key would
 * mean a grant needed by CloudFront also applied to the database.
 *
 * ~$1/month, and worth it here specifically because of what the bucket holds:
 * government identity documents and professional credential certificates. The
 * key policy is the control that makes those unreadable outside production,
 * regardless of who later fat-fingers a bucket policy.
 */

data "aws_iam_policy_document" "s3_key" {
  statement {
    sid    = "EnableAccountAdministration"
    effect = "Allow"

    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${var.account_id}:root"]
    }

    actions   = ["kms:*"]
    resources = ["*"]
  }

  /**
   * CloudFront needs to decrypt objects it serves through the Origin Access
   * Control.
   *
   * Scoped by SourceArn to distributions in THIS account. A wildcard on the
   * distribution id rather than the real one is deliberate — naming the
   * distribution would create a dependency cycle (key -> distribution ->
   * bucket -> key). Account scoping is the standard way to break it, and it
   * still prevents any other account's CloudFront from using this key.
   */
  statement {
    sid    = "AllowCloudFrontDecrypt"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    actions   = ["kms:Decrypt", "kms:GenerateDataKey*"]
    resources = ["*"]

    condition {
      test     = "StringLike"
      variable = "aws:SourceArn"
      values   = ["arn:aws:cloudfront::${var.account_id}:distribution/*"]
    }
  }
}

resource "aws_kms_key" "uploads" {
  description             = "Encrypts the production uploads bucket (identity documents, credentials, media)."
  enable_key_rotation     = true
  deletion_window_in_days = 30
  policy                  = data.aws_iam_policy_document.s3_key.json

  tags = { Name = "sc-prod-s3-key" }
}

resource "aws_kms_alias" "uploads" {
  name          = "alias/sc-prod-s3"
  target_key_id = aws_kms_key.uploads.key_id
}
