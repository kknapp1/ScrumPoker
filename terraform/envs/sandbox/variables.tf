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

variable "application_tag" {
  description = "The scrum-poker AppRegistry Application's application_tag output from terraform/bootstrap (for this account) — merged into local.tags so every resource here associates with that Application. Defaults to {} so this still works for an account where bootstrap hasn't been re-applied with the Application yet."
  type        = map(string)
  default     = {}
}
