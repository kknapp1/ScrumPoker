variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-2"
}

variable "bucket_name" {
  description = "App bucket created by terraform/bootstrap for this AWS account (output as bucket_name there)"
  type        = string
}

variable "builds_prefix" {
  description = "Key prefix within bucket_name for build artifacts"
  type        = string
  default     = "builds"
}

variable "deploy_prefix" {
  description = "Key prefix within bucket_name for the deployed frontend static site"
  type        = string
  default     = "deploy"
}
