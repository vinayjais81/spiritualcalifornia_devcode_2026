terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
  }

  backend "s3" {
    bucket       = "sc-tfstate-372110294387"
    key          = "prod/compute/terraform.tfstate"
    region       = "us-west-1"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region              = var.region
  allowed_account_ids = [var.account_id]

  default_tags {
    tags = {
      Project     = "spiritual-california"
      Environment = "prod"
      Owner       = "engineering"
      CostCenter  = "sc-prod"
      ManagedBy   = "terraform"
    }
  }
}

data "aws_caller_identity" "current" {}

data "terraform_remote_state" "network" {
  backend = "s3"
  config = {
    bucket = "sc-tfstate-372110294387"
    key    = "prod/network/terraform.tfstate"
    region = "us-west-1"
  }
}

data "terraform_remote_state" "storage" {
  backend = "s3"
  config = {
    bucket = "sc-tfstate-372110294387"
    key    = "prod/storage/terraform.tfstate"
    region = "us-west-1"
  }
}

data "aws_sns_topic" "alerts" {
  name = "sc-prod-alerts"
}
