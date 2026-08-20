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
    key          = "prod/network/terraform.tfstate"
    region       = "us-west-1"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region              = var.region
  allowed_account_ids = [var.account_id]

  # Environment=prod is what the IAM permission boundary matches on. An
  # untagged resource sits outside the isolation policy entirely — see §4
  # Layer 2 of the deployment plan.
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
