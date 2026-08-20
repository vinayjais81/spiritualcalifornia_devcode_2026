/**
 * Instance role.
 *
 * The app authenticates to AWS through this role rather than through
 * AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in a .env file. The SDK's default
 * credential chain picks the instance profile up automatically when those
 * variables are absent, so the correct production .env simply omits them —
 * no static key exists to leak, and credentials rotate on their own.
 */

resource "aws_iam_role" "app" {
  name        = "sc-prod-ec2-role"
  description = "Production application instances."

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = { Name = "sc-prod-ec2-role" }
}

resource "aws_iam_instance_profile" "app" {
  name = "sc-prod-ec2-profile"
  role = aws_iam_role.app.name

  tags = { Name = "sc-prod-ec2-profile" }
}

/**
 * SSM Session Manager.
 *
 * This is what replaces SSH. No inbound port, no key pair, no key to leak,
 * and every session recorded in CloudTrail. It is also how P8 delivers
 * deploys — SendCommand rather than an SSH connection from GitHub.
 */
resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.app.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy_attachment" "cloudwatch" {
  role       = aws_iam_role.app.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

# Object access plus the KMS grant, defined next to the bucket in P4.
resource "aws_iam_role_policy_attachment" "uploads" {
  role       = aws_iam_role.app.name
  policy_arn = data.terraform_remote_state.storage.outputs.app_uploads_policy_arn
}

data "aws_iam_policy_document" "app" {
  /**
   * Read production configuration.
   *
   * Scoped to the /sc/prod/* path — the same prefix the deploy role is
   * limited to. This is Layer 2 of the isolation model expressed as an
   * actual policy: a production instance cannot read a QA parameter, and
   * nothing outside this path is visible to it.
   */
  statement {
    sid    = "ReadProdConfig"
    effect = "Allow"
    actions = [
      "ssm:GetParameter",
      "ssm:GetParameters",
      "ssm:GetParametersByPath",
    ]
    resources = ["arn:aws:ssm:${var.region}:${var.account_id}:parameter/sc/prod/*"]
  }

  # SecureString parameters are KMS-encrypted, so reading them needs decrypt
  # via SSM. Without this the app gets an opaque AccessDenied on config it
  # is otherwise permitted to read.
  statement {
    sid       = "DecryptConfig"
    effect    = "Allow"
    actions   = ["kms:Decrypt"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["ssm.${var.region}.amazonaws.com"]
    }
  }

  # Credential OCR during guide verification.
  statement {
    sid       = "Textract"
    effect    = "Allow"
    actions   = ["textract:AnalyzeDocument", "textract:DetectDocumentText"]
    resources = ["*"]
  }

  # bootstrap-db.sh writes the sc_app password back after creating the role.
  statement {
    sid       = "WriteAppDbPassword"
    effect    = "Allow"
    actions   = ["ssm:PutParameter"]
    resources = ["arn:aws:ssm:${var.region}:${var.account_id}:parameter/sc/prod/rds/app-password"]
  }
}

resource "aws_iam_policy" "app" {
  name        = "sc-prod-app-policy"
  description = "Config, decryption, and Textract for the production app."
  policy      = data.aws_iam_policy_document.app.json

  tags = { Name = "sc-prod-app-policy" }
}

resource "aws_iam_role_policy_attachment" "app" {
  role       = aws_iam_role.app.name
  policy_arn = aws_iam_policy.app.arn
}

/**
 * Deploy permissions, granted to the GitHub OIDC role created in P1.
 *
 * Added here rather than there because P1 ran before these resources
 * existed — a deploy role cannot be scoped to an Auto Scaling group and a
 * target group that have not been created yet.
 */
data "aws_iam_policy_document" "deploy_extra" {
  # Deliver the deploy script to instances. Not a general RunCommand grant:
  # limited to the one document that runs shell commands, on prod-tagged
  # instances only.
  statement {
    sid       = "SendDeployCommand"
    effect    = "Allow"
    actions   = ["ssm:SendCommand"]
    resources = ["arn:aws:ssm:${var.region}::document/AWS-RunShellScript"]
  }

  statement {
    sid       = "SendToProdInstances"
    effect    = "Allow"
    actions   = ["ssm:SendCommand"]
    resources = ["arn:aws:ec2:${var.region}:${var.account_id}:instance/*"]

    condition {
      test     = "StringEquals"
      variable = "ssm:resourceTag/Environment"
      values   = ["prod"]
    }
  }

  statement {
    sid    = "TrackCommand"
    effect = "Allow"
    actions = [
      "ssm:GetCommandInvocation",
      "ssm:ListCommandInvocations",
      "ssm:DescribeInstanceInformation",
    ]
    resources = ["*"]
  }

  # Rolling deploys: take an instance out of rotation, deploy, put it back.
  statement {
    sid    = "RotateTargets"
    effect = "Allow"
    actions = [
      "elasticloadbalancing:RegisterTargets",
      "elasticloadbalancing:DeregisterTargets",
    ]
    resources = [
      aws_lb_target_group.web.arn,
      aws_lb_target_group.api.arn,
    ]
  }
}

resource "aws_iam_policy" "deploy_extra" {
  name        = "sc-prod-deploy-compute-policy"
  description = "Lets the GitHub OIDC role deploy to instances and rotate them through the target groups."
  policy      = data.aws_iam_policy_document.deploy_extra.json

  tags = { Name = "sc-prod-deploy-compute-policy" }
}

resource "aws_iam_role_policy_attachment" "deploy_extra" {
  role       = "sc-prod-deploy-role" # created in P1
  policy_arn = aws_iam_policy.deploy_extra.arn
}
