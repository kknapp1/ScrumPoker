variable "environment" {
  description = "Environment name for this account (sandbox, test, production) — used to name the GitHub Actions deploy role"
  type        = string
  default     = "sandbox"
}

variable "repo" {
  description = "GitHub repo in \"org/name\" form, used for the GitHub Actions deploy role's trust policy"
  type        = string
  default     = "kknapp1/ScrumPoker"
}
