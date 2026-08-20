/**
 * GitHub Actions → AWS via OIDC.
 *
 * This exists to delete a class of risk rather than to add a feature. The QA
 * pipeline authenticates with a long-lived SSH key held in GitHub secrets; a
 * leaked secret there is a standing key to the box, valid until someone
 * notices and rotates it.
 *
 * OIDC issues a short-lived credential per workflow run, scoped by the trust
 * policy below to one repository AND one GitHub Environment. There is no
 * static AWS key in GitHub to leak.
 */

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]

  # AWS no longer verifies this for well-known providers, but the argument is
  # still required by the API.
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]

  tags = {
    Name        = "github-actions-oidc"
    Environment = "shared"
  }
}

data "aws_iam_policy_document" "github_deploy_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    /**
     * Pinned to `environment:production`, NOT to a branch.
     *
     * A branch-scoped condition (`ref:refs/heads/main`) would let any push to
     * main assume this role. Environment scoping means the job must run in a
     * GitHub Environment, which carries required-reviewer protection — so
     * production deploys need a human approval before the credential is
     * issued at all.
     *
     * StringEquals, not StringLike: no wildcards in a trust policy.
     */
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_org}/${var.github_repo}:environment:${var.github_environment}"]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  name        = "sc-prod-deploy-role"
  description = "Assumed by GitHub Actions (OIDC) to deploy production. No long-lived keys."

  assume_role_policy   = data.aws_iam_policy_document.github_deploy_trust.json
  max_session_duration = 3600

  tags = {
    Name        = "sc-prod-deploy-role"
    Environment = "prod"
  }
}

/**
 * Deploy permissions.
 *
 * Intentionally narrow at P1, because production does not exist yet. P8
 * extends this with the SSM SendCommand and target-group calls the rolling
 * deploy needs, once there is something to send them to.
 *
 * Note what is absent and stays absent: no iam:*, no s3:DeleteBucket, no
 * rds:DeleteDBInstance. A deploy credential should not be able to dismantle
 * the environment it deploys to.
 */
data "aws_iam_policy_document" "github_deploy" {
  # Read the production .env blobs to render them onto instances.
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

  # Record the deployed commit so a replacement instance bootstraps to the
  # same code rather than whatever the AMI happened to contain.
  statement {
    sid       = "WriteDeployPointer"
    effect    = "Allow"
    actions   = ["ssm:PutParameter"]
    resources = ["arn:aws:ssm:${var.region}:${var.account_id}:parameter/sc/prod/app/target-sha"]
  }

  # Pre-deploy snapshot. Create and inspect only — never delete or restore.
  statement {
    sid    = "PreDeploySnapshot"
    effect = "Allow"
    actions = [
      "rds:CreateDBSnapshot",
      "rds:DescribeDBSnapshots",
      "rds:DescribeDBInstances",
      "rds:AddTagsToResource",
    ]
    resources = ["*"]
  }

  # Read-only discovery so the pipeline can find its own instances.
  statement {
    sid    = "DescribeTargets"
    effect = "Allow"
    actions = [
      "ec2:DescribeInstances",
      "autoscaling:DescribeAutoScalingGroups",
      "elasticloadbalancing:DescribeTargetGroups",
      "elasticloadbalancing:DescribeTargetHealth",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "github_deploy" {
  name        = "sc-prod-deploy-policy"
  description = "Least-privilege deploy permissions for the GitHub OIDC role."
  policy      = data.aws_iam_policy_document.github_deploy.json

  tags = {
    Environment = "prod"
  }
}

resource "aws_iam_role_policy_attachment" "github_deploy" {
  role       = aws_iam_role.github_deploy.name
  policy_arn = aws_iam_policy.github_deploy.arn
}
