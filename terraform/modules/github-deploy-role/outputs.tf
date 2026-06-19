output "role_arn" {
  value       = aws_iam_role.deploy.arn
  description = "Set as AWS_DEPLOY_ROLE_ARN secret in the matching GitHub Environment"
}

output "role_name" {
  value = aws_iam_role.deploy.name
}
