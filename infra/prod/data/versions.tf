terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  backend "s3" {
    bucket       = "sc-tfstate-372110294387"
    key          = "prod/data/terraform.tfstate"
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

/**
 * Network IDs come from the P2 stack rather than being duplicated here.
 *
 * Read-only: this stack can see the VPC's outputs but cannot modify it, so a
 * mistake in the data tier cannot damage the network underneath it.
 */
data "terraform_remote_state" "network" {
  backend = "s3"

  config = {
    bucket = "sc-tfstate-372110294387"
    key    = "prod/network/terraform.tfstate"
    region = "us-west-1"
  }
}
