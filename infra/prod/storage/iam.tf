/**
 * The application's access to the bucket.
 *
 * Created here, next to the resources it grants, but ATTACHED in P6 to the
 * EC2 instance profile. Splitting it that way means this stack owns the
 * permission's shape and the compute stack owns who holds it.
 *
 * Note the app does not get s3:DeleteBucket, s3:PutBucketPolicy, or any
 * configuration action. It uploads, reads, and deletes objects — nothing
 * that could reconfigure or dismantle the bucket.
 */

data "aws_iam_policy_document" "app_uploads_access" {
  statement {
    sid    = "ObjectAccess"
    effect = "Allow"

    actions = [
      "s3:GetObject",
      "s3:GetObjectVersion",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:AbortMultipartUpload",
    ]

    resources = ["${aws_s3_bucket.uploads.arn}/*"]
  }

  # Needed so the SDK can list and locate objects, and to generate pre-signed
  # URLs against the right region.
  statement {
    sid    = "BucketListing"
    effect = "Allow"

    actions = [
      "s3:ListBucket",
      "s3:GetBucketLocation",
    ]

    resources = [aws_s3_bucket.uploads.arn]
  }

  /**
   * Without this the app can write objects it can never read back.
   *
   * SSE-KMS means every GetObject requires kms:Decrypt and every PutObject
   * requires kms:GenerateDataKey. Granting S3 access and forgetting the key
   * produces AccessDenied errors that look like a bucket-policy problem and
   * are not.
   */
  statement {
    sid    = "UseTheBucketKey"
    effect = "Allow"

    actions = [
      "kms:Decrypt",
      "kms:GenerateDataKey",
    ]

    resources = [aws_kms_key.uploads.arn]

    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["s3.${var.region}.amazonaws.com"]
    }
  }
}

resource "aws_iam_policy" "app_uploads_access" {
  name        = "sc-prod-app-uploads-policy"
  description = "S3 object access plus the KMS grant that makes it usable. Attached to the app instance profile in P6."
  policy      = data.aws_iam_policy_document.app_uploads_access.json

  tags = { Name = "sc-prod-app-uploads-policy" }
}
