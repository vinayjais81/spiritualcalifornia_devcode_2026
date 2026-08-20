/**
 * Customer-managed encryption key for the data tier.
 *
 * AWS offers a free managed key (`aws/rds`), so why pay ~$1/month?
 *
 * Because the key POLICY is Layer 3 of the isolation model. The managed key
 * is usable by the account broadly; this one names only production
 * principals. A snapshot shared or copied to a QA-owned context is
 * unreadable, because the QA roles appear nowhere in this policy.
 *
 * That is the difference between "QA should not read production data" as a
 * convention and as a cryptographic fact.
 */

data "aws_caller_identity" "current" {}

data "aws_iam_policy_document" "rds_key" {
  # Without this, the key becomes unmanageable — AWS explicitly warns that a
  # key policy denying the account root can be locked out permanently.
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

  # The AWS services that need to encrypt with it on our behalf.
  statement {
    sid    = "AllowDataServices"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["rds.amazonaws.com", "elasticache.amazonaws.com"]
    }

    actions = [
      "kms:Encrypt",
      "kms:Decrypt",
      "kms:ReEncrypt*",
      "kms:GenerateDataKey*",
      "kms:CreateGrant",
      "kms:DescribeKey",
    ]

    resources = ["*"]

    # Scope to this account, so the grant cannot be exercised from elsewhere.
    condition {
      test     = "StringEquals"
      variable = "kms:CallerAccount"
      values   = [var.account_id]
    }
  }
}

resource "aws_kms_key" "data" {
  description             = "Encrypts the production RDS instance and ElastiCache at rest."
  enable_key_rotation     = true
  deletion_window_in_days = 30
  policy                  = data.aws_iam_policy_document.rds_key.json

  tags = { Name = "sc-prod-data-key" }
}

resource "aws_kms_alias" "data" {
  name          = "alias/sc-prod-data"
  target_key_id = aws_kms_key.data.key_id
}
