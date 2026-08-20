/**
 * Bootstrap — creates the S3 bucket that stores Terraform state for every
 * other stack.
 *
 * This stack keeps its own state LOCAL, because the bucket it creates is the
 * thing remote state would live in. Run it once, ever. The resulting
 * terraform.tfstate here describes only the bucket; it is gitignored, and
 * losing it is recoverable (import the bucket, or leave it be — nothing else
 * depends on this stack's state).
 */

terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
  }
}

provider "aws" {
  region = var.region

  # Guardrail: refuse to run against the wrong AWS account. Cheap insurance
  # when the same workstation has credentials for more than one client.
  allowed_account_ids = [var.account_id]

  default_tags {
    tags = {
      Project   = "spiritual-california"
      ManagedBy = "terraform"
      Stack     = "bootstrap"
    }
  }
}

variable "region" {
  description = "AWS region. Matches QA so production stays in one region — see decision D1."
  type        = string
  default     = "us-west-1"
}

variable "account_id" {
  description = "The client AWS account this may run against."
  type        = string
  default     = "372110294387"
}

resource "aws_s3_bucket" "tfstate" {
  bucket = "sc-tfstate-${var.account_id}"

  # State describes the whole environment. Deleting it does not delete
  # infrastructure, but it does orphan it — Terraform would then try to
  # recreate resources that already exist.
  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Name        = "sc-tfstate"
    Environment = "shared"
  }
}

# Versioning is the undo button: a corrupted or truncated state file can be
# rolled back to the previous object version. Non-negotiable for state.
resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  versioning_configuration {
    status = "Enabled"
  }
}

# State contains resource identifiers and can contain secrets pulled into
# outputs. Encrypt at rest.
resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Old state versions accumulate on every apply. Keep 90 days — long enough to
# recover from a mistake noticed late, short enough not to pay for years of
# them.
resource "aws_s3_bucket_lifecycle_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  rule {
    id     = "expire-old-state-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 90
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

output "state_bucket" {
  description = "Put this in the backend block of every other stack."
  value       = aws_s3_bucket.tfstate.id
}
