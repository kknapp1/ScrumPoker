variable "environment" {
  description = "Environment name (sandbox, production) — used as a naming prefix"
  type        = string
}

variable "aws_region" {
  description = "AWS region the Lambda functions and API Gateway are deployed in"
  type        = string
}

variable "connections_table_name" {
  type = string
}

variable "connections_table_arn" {
  type = string
}

variable "connections_table_gsi_arn" {
  type = string
}

variable "rooms_table_name" {
  type = string
}

variable "rooms_table_arn" {
  type = string
}

variable "votes_table_name" {
  type = string
}

variable "votes_table_arn" {
  type = string
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
