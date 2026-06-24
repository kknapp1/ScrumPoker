terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
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

module "deploy_role" {
  source             = "../../modules/github-deploy-role"
  role_name          = "scrumpoker-sandbox-github-actions"
  policy_name        = "scrum-poker-sandbox-github-actions-policy"
  repo               = var.repo
  github_environment = local.env
  bucket_name        = var.bucket_name
  builds_prefix      = var.builds_prefix
  deploy_prefix      = var.deploy_prefix
  tags               = local.tags
  # app_table_arns intentionally left at its wildcard default (scrumpoker-*)
  # rather than wired to module.app_tables outputs: referencing the actual
  # table ARNs would make this policy update depend on the tables already
  # existing, forcing Terraform to attempt CreateTable before the permission
  # to do so is granted — the same chicken-and-egg trap documented in
  # CLAUDE.md for data-source reads, but here on resource creation order.
}

module "app_tables" {
  source      = "../../modules/dynamodb-app-tables"
  environment = local.env
  tags        = local.tags

  # No data dependency on deploy_role, but explicit ordering avoids an IAM
  # eventual-consistency race: without this, Terraform applies app_tables
  # and deploy_role's policy update concurrently (no reference between
  # them), and CreateTable can fire before the new permission has
  # propagated. depends_on forces the policy update to fully complete first.
  depends_on = [module.deploy_role]
}

module "websocket_backend" {
  source                    = "../../modules/websocket-backend"
  environment               = local.env
  aws_region                = var.aws_region
  connections_table_name    = module.app_tables.connections_table_name
  connections_table_arn     = module.app_tables.connections_table_arn
  connections_table_gsi_arn = module.app_tables.connections_table_gsi_arn
  rooms_table_name          = module.app_tables.rooms_table_name
  rooms_table_arn           = module.app_tables.rooms_table_arn
  votes_table_name          = module.app_tables.votes_table_name
  votes_table_arn           = module.app_tables.votes_table_arn
  tags                      = local.tags

  # Same reasoning as app_tables above — this module creates an IAM role,
  # Lambda functions, and an API Gateway API, all needing permissions this
  # run grants to the deploy role itself.
  depends_on = [module.deploy_role]
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

output "websocket_endpoint" {
  value = module.websocket_backend.websocket_endpoint
}
