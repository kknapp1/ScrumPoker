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
  env = "sandbox"
  tags = {
    Project     = "scrum-poker"
    Environment = local.env
    ManagedBy   = "terraform"
    Owner       = "Kenny Knapp"
  }
}

module "frontend" {
  source      = "../../modules/frontend-hosting"
  bucket_name = var.bucket_name
  key_prefix  = var.deploy_prefix
  environment = local.env
  tags        = local.tags
}

module "app_tables" {
  source      = "../../modules/dynamodb-app-tables"
  environment = local.env
  tags        = local.tags
}

module "deploy_role" {
  source             = "../../modules/github-deploy-role"
  role_name          = "scrumpoker-sandbox-github-actions"
  policy_name        = "scrum-poker-sandbox-github-actions-policy"
  repo               = var.repo
  github_environment = local.env
  bucket_name        = var.bucket_name
  builds_prefix      = var.builds_prefix
  deploy_prefix      = var.deploy_prefix
  app_table_arns = [
    module.app_tables.connections_table_arn,
    module.app_tables.connections_table_gsi_arn,
    module.app_tables.rooms_table_arn,
    module.app_tables.votes_table_arn,
  ]
  tags = local.tags
}

# ── Outputs consumed by GitHub Actions ────────────────────────

output "cloudfront_domain" {
  value = module.frontend.cloudfront_domain
}

output "frontend_bucket" {
  value = module.frontend.bucket_name
}

output "frontend_key_prefix" {
  value = module.frontend.key_prefix
}

output "builds_bucket" {
  value = var.bucket_name
}

output "builds_prefix" {
  value = var.builds_prefix
}

output "cloudfront_distribution_id" {
  value = module.frontend.cloudfront_distribution_id
}

output "deploy_role_arn" {
  value = module.deploy_role.role_arn
}

output "connections_table_name" {
  value = module.app_tables.connections_table_name
}

output "rooms_table_name" {
  value = module.app_tables.rooms_table_name
}

output "votes_table_name" {
  value = module.app_tables.votes_table_name
}
