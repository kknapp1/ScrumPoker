variable "environment" {
  description = "Environment name (sandbox, production) — used as a naming prefix for the app tables"
  type        = string
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
