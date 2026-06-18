variable "bucket_name" {
  description = "S3 bucket name for frontend assets"
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
