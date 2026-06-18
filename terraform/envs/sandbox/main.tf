terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  # backend configured in backend.tf
}

provider "aws" {
  region = var.aws_region
}

locals {
  env  = "sandbox"
  tags = {
    Project     = "scrum-poker"
    Environment = local.env
    ManagedBy   = "terraform"
  }
}

module "frontend" {
  source      = "../../modules/frontend-hosting"
  bucket_name = "scrum-poker-frontend-${local.env}"
  environment = local.env
  tags        = local.tags
}

# ── Outputs consumed by GitHub Actions ────────────────────────

output "cloudfront_domain" {
  value = module.frontend.cloudfront_domain
}

output "frontend_bucket" {
  value = module.frontend.bucket_name
}

output "cloudfront_distribution_id" {
  value = module.frontend.cloudfront_distribution_id
}
