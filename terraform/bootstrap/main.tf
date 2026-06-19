/**
 * Bootstrap — run ONCE per AWS account (sandbox, test, prod) to create the
 * app bucket and lock table used by terraform/envs/<env>:
 *
 *   scrum-poker-<randomid>/
 *     state/    Terraform remote state
 *     builds/   Build artifacts (e.g. zip archives) staged for release
 *     deploy/   Static site files, served via CloudFront
 *
 * A random suffix keeps the bucket name globally unique across accounts —
 * the environment name is deliberately NOT part of the bucket name or key
 * prefixes, since each account gets its own bucket and this same app/state
 * is deployed unmodified across sandbox/test/prod.
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
  tags = {
    Project   = "scrum-poker"
    ManagedBy = "terraform"
    Owner     = "Kenny Knapp"
  }
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

output "bucket_name" {
  value       = aws_s3_bucket.app.id
  description = "Use as backend bucket (state/) and as bucket_name var (builds/, deploy/) for this account's envs/<env>"
}

output "lock_table" {
  value = aws_dynamodb_table.tflock.name
}
