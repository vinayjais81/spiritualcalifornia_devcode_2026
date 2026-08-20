terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
  }

  /**
   * State lives in the bucket created by ../bootstrap.
   *
   * `use_lockfile` is native S3 state locking (Terraform 1.10+), which
   * replaces the old DynamoDB lock table. If you are pinned to an older
   * Terraform, drop this line and add `dynamodb_table = "..."` plus a table
   * with a `LockID` primary key.
   */
  backend "s3" {
    bucket       = "sc-tfstate-372110294387"
    key          = "account/terraform.tfstate"
    region       = "us-west-1"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.region

  # Refuse to run against any account but the client's.
  allowed_account_ids = [var.account_id]

  /**
   * Every resource this stack creates is tagged automatically.
   *
   * These tags are not cosmetic. The IAM permission boundary that stops a
   * compromised QA credential from touching production keys on
   * `aws:ResourceTag/Environment`, so an untagged resource sits OUTSIDE the
   * isolation policy — a hole, not just untidiness. See §4 Layer 2 and §5 of
   * the deployment plan.
   */
  default_tags {
    tags = {
      Project    = "spiritual-california"
      Owner      = "engineering"
      ManagedBy  = "terraform"
      CostCenter = "sc-prod"
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
