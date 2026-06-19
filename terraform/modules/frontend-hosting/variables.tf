variable "bucket_name" {
  description = "Existing app bucket for this AWS account (created in terraform/bootstrap)"
  type        = string
}

variable "key_prefix" {
  description = "Folder prefix within bucket_name for frontend deploys, e.g. \"deploy\" (no leading/trailing slash)"
  type        = string
}

variable "environment" {
  description = "Environment name (sandbox, production)"
  type        = string
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
