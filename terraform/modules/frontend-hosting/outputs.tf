output "bucket_name" {
  value = data.aws_s3_bucket.frontend.id
}

output "bucket_arn" {
  value = data.aws_s3_bucket.frontend.arn
}

output "key_prefix" {
  value       = var.key_prefix
  description = "Folder within bucket_name that this environment's frontend is deployed under"
}

output "cloudfront_domain" {
  value       = aws_cloudfront_distribution.frontend.domain_name
  description = "CloudFront URL — use this to access the app"
}

output "cloudfront_distribution_id" {
  value       = aws_cloudfront_distribution.frontend.id
  description = "Used by GitHub Actions to invalidate cache on deploy"
}
