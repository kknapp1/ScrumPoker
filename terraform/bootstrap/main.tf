/**
 * Bootstrap — run ONCE to create the S3 bucket that stores Terraform state.
 *
 * Usage:
 *   cd terraform/bootstrap
 *   terraform init
 *   terraform apply
 *
 * After this runs, configure terraform/envs/sandbox/backend.tf with the
 * bucket name output here.
 */

terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-2"
}

resource "aws_s3_bucket" "tfstate" {
  bucket = "scrum-poker-tfstate-${random_id.suffix.hex}"

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Project     = "scrum-poker"
    ManagedBy   = "terraform"
  }
}

resource "random_id" "suffix" {
  byte_length = 4
}

resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket                  = aws_s3_bucket.tfstate.id
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

  tags = {
    Project   = "scrum-poker"
    ManagedBy = "terraform"
  }
}

output "state_bucket" {
  value       = aws_s3_bucket.tfstate.id
  description = "Paste this into terraform/envs/sandbox/backend.tf"
}

output "lock_table" {
  value = aws_dynamodb_table.tflock.name
}
