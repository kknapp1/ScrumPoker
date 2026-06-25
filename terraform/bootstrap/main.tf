/**
 * Bootstrap — run ONCE per AWS account (sandbox, test, prod), MANUALLY, by
 * someone with admin credentials, before envs/<env> is ever deployed via CI.
 * Creates:
 *
 *   - the app bucket + lock table used by terraform/envs/<env>:
 *       scrum-poker-<randomid>/
 *         state/    Terraform remote state
 *         builds/   Build artifacts (e.g. zip archives) staged for release
 *         deploy/   Static site files, served via CloudFront
 *   - the GitHub Actions deploy role (modules/github-deploy-role) that CI
 *     assumes to run terraform/envs/<env>
 *
 * Why the deploy role lives here and not in envs/<env>: that role's own IAM
 * policy can never safely be modified by a Terraform run *using that same
 * role* — granting a permission and immediately needing it (in the same
 * plan/apply) races IAM's eventual consistency, and any permission the
 * data-source refresh needs is a chicken-and-egg lockout (the run can't
 * even compute a plan without a permission only that same plan would
 * grant). Keeping the role's permissions entirely outside CI's reach means
 * they're granted up front, manually, and policy edits go through this
 * same manual path instead of fighting CI's own apply ordering.
 *
 * envs/<env> (run by CI) only ever manages app resources — frontend
 * hosting, DynamoDB app tables, Lambda, API Gateway — never its own
 * deploy role. The role's ARN is configured separately as the
 * AWS_DEPLOY_ROLE_ARN GitHub secret (not wired through Terraform outputs
 * into CI, to avoid the same self-reference problem).
 *
 * Usage:
 *   cd terraform/bootstrap
 *   terraform init
 *   terraform apply
 *
 * Take the `bucket_name` output and:
 *   - pass it to `terraform init -backend-config="bucket=<value>"` in
 *     terraform/envs/<env> (see backend.tf there)
 *   - pass it as -var="bucket_name=<value>" (or TF_VAR_bucket_name) when
 *     running terraform/envs/<env> and in that environment's GitHub Actions
 *     workflow / environment variables
 *   - keep `terraform/bootstrap` in sync after each account's first deploy:
 *     if envs/<env> grows new resource types, the deploy role's policy
 *     here needs the matching permissions added and re-applied manually
 *     BEFORE the next CI run that needs them.
 */

terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

provider "aws" {
  region = "us-east-2"
}

locals {
  base_tags = {
    Project   = "scrum-poker"
    ManagedBy = "terraform"
    Owner     = "Kenny Knapp"
  }
  # Merging in the AppRegistry application_tag causes every resource that
  # uses local.tags to auto-associate with the "scrum-poker" Application
  # (AWS's myApplications/Cost Explorer grouping) — no separate
  # per-resource association needed for the resource types this app uses.
  tags = merge(local.base_tags, aws_servicecatalogappregistry_application.app.application_tag)
}

# Groups every resource tagged with the application_tag below into a
# single "Application" for unified cost/usage tracking in the AWS console
# (myApplications) and Cost Explorer — distinct from (and complementary
# to) the plain Project=scrum-poker tag, which is just a filterable tag,
# not a first-class grouping construct with its own dashboard.
resource "aws_servicecatalogappregistry_application" "app" {
  name        = "scrum-poker"
  description = "Scrum Poker — internal collaborative planning poker tool"
  tags        = local.base_tags
}

resource "random_id" "suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "app" {
  bucket = "scrum-poker-${random_id.suffix.hex}"

  lifecycle {
    prevent_destroy = true
  }

  tags = local.tags
}

# Versioning protects the state/ prefix; applies bucket-wide since S3
# versioning is not configurable per key prefix.
resource "aws_s3_bucket_versioning" "app" {
  bucket = aws_s3_bucket.app.id
  versioning_configuration {
    status = "Enabled"
  }
}

# tfsec flags AES256 (AWS-managed keys) as wanting a customer-managed KMS
# key instead — accepted risk, not a gap: this bucket holds build
# artifacts and Terraform state, not customer/PII data, and a CMK adds
# real ongoing cost ($1/mo) and key-rotation operational overhead
# disproportionate to that data's sensitivity.
#tfsec:ignore:aws-s3-encryption-customer-key
resource "aws_s3_bucket_server_side_encryption_configuration" "app" {
  bucket = aws_s3_bucket.app.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "app" {
  bucket                  = aws_s3_bucket.app.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# tfsec wants an explicit customer-managed KMS key here too — same
# accepted-risk rationale as the bucket above. DynamoDB encrypts at rest
# by default (AWS-owned key) even without this block; this table only
# ever holds Terraform's own lock records, not application data.
#tfsec:ignore:aws-dynamodb-enable-at-rest-encryption
resource "aws_dynamodb_table" "tflock" {
  name         = "scrum-poker-tflock"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = local.tags
}

module "deploy_role" {
  source             = "../modules/github-deploy-role"
  role_name          = "scrumpoker-${var.environment}-github-actions"
  policy_name        = "scrum-poker-${var.environment}-github-actions-policy"
  repo               = var.repo
  github_environment = var.environment
  bucket_name        = aws_s3_bucket.app.id
  lock_table_name    = aws_dynamodb_table.tflock.name
  tags               = local.tags
}

output "bucket_name" {
  value       = aws_s3_bucket.app.id
  description = "Use as backend bucket (state/) and as bucket_name var (builds/, deploy/) for this account's envs/<env>"
}

output "application_tag" {
  value       = aws_servicecatalogappregistry_application.app.application_tag
  description = "Merge into envs/<env>'s local.tags (e.g. via -var=\"application_tag={...}\") so its resources also associate with the scrum-poker AppRegistry Application"
}

output "deploy_role_arn" {
  value       = module.deploy_role.role_arn
  description = "Configure as the AWS_DEPLOY_ROLE_ARN secret for this account's GitHub Environment"
}

output "lock_table" {
  value = aws_dynamodb_table.tflock.name
}
