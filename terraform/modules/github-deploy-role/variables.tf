variable "role_name" {
  description = "IAM role name assumed by the GitHub Actions deploy workflow"
  type        = string
}

variable "policy_name" {
  description = "Name of the inline policy attached to role_name"
  type        = string
}

variable "repo" {
  description = "GitHub repo in \"org/name\" form, e.g. kknapp1/ScrumPoker"
  type        = string
}

variable "github_environment" {
  description = "GitHub Environment name this role's trust policy is scoped to (e.g. sandbox, test, production)"
  type        = string
}

variable "branch" {
  description = "Branch this role's trust policy is scoped to, for non-environment-gated triggers"
  type        = string
  default     = "main"
}

variable "bucket_name" {
  description = "Per-account app bucket (scrum-poker-<randomid>) created by terraform/bootstrap"
  type        = string
}

variable "state_prefix" {
  type    = string
  default = "state"
}

variable "builds_prefix" {
  type    = string
  default = "builds"
}

variable "deploy_prefix" {
  type    = string
  default = "deploy"
}

variable "lock_table_name" {
  description = "DynamoDB table used for Terraform state locking"
  type        = string
  default     = "scrum-poker-tflock"
}

variable "app_table_arns" {
  description = "ARNs (including GSI ARNs) of the app's own DynamoDB tables (connections, rooms, votes) this role manages via Terraform"
  type        = list(string)
  default     = []
}

variable "tags" {
  type    = map(string)
  default = {}
}
