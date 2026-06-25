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
  tags = merge({
    Project     = "scrum-poker"
    Environment = local.env
    ManagedBy   = "terraform"
    Owner       = "Kenny Knapp"
  }, var.application_tag)
}

module "frontend" {
  source      = "../../modules/frontend-hosting"
  bucket_name = var.bucket_name
  key_prefix  = var.deploy_prefix
  environment = local.env
  tags        = local.tags
}

# The GitHub Actions deploy role itself is NOT managed here — see the
# comment at the top of terraform/bootstrap/main.tf for why. This run
# assumes that role (via OIDC, configured outside Terraform) but never
# creates or modifies it.

module "app_tables" {
  source      = "../../modules/dynamodb-app-tables"
  environment = local.env
  tags        = local.tags
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
