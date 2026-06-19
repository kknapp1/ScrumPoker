/**
 * IAM role assumed by GitHub Actions (via OIDC) to deploy this app's
 * Terraform + frontend for one environment/AWS account.
 *
 * The GitHub OIDC provider (token.actions.githubusercontent.com) is shared
 * org-wide and created once outside this app — referenced here, not created.
 */

data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

data "aws_dynamodb_table" "tflock" {
  name = var.lock_table_name
}

resource "aws_iam_role" "deploy" {
  name        = var.role_name
  description = "Allow github actions deployment for the Scrum Poker webapp"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = data.aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          "token.actions.githubusercontent.com:sub" = [
            "repo:${var.repo}:environment:${var.github_environment}",
            "repo:${var.repo}:ref:refs/heads/${var.branch}",
          ]
        }
      }
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "deploy" {
  name = var.policy_name
  role = aws_iam_role.deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "BucketLevelAccess"
        Effect   = "Allow"
        Action   = ["s3:ListBucket", "s3:GetBucketLocation"]
        Resource = "arn:aws:s3:::${var.bucket_name}"
      },
      {
        Sid    = "TerraformStateAccess"
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = [
          "arn:aws:s3:::${var.bucket_name}/${var.state_prefix}/*",
        ]
      },
      {
        Sid    = "BuildArtifactAccess"
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = [
          "arn:aws:s3:::${var.bucket_name}/${var.builds_prefix}/*",
        ]
      },
      {
        Sid    = "FrontendDeployAccess"
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = [
          "arn:aws:s3:::${var.bucket_name}/${var.deploy_prefix}/*",
        ]
      },
      {
        Sid      = "TerraformLockTable"
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem"]
        Resource = data.aws_dynamodb_table.tflock.arn
      },
      {
        # CloudFront has no resource-level permissions for Create*, so this
        # stays account-wide rather than scoped to one distribution ARN.
        Sid    = "CloudFrontManagement"
        Effect = "Allow"
        Action = [
          "cloudfront:CreateDistribution",
          "cloudfront:CreateOriginAccessControl",
          "cloudfront:CreateInvalidation",
          "cloudfront:Get*",
          "cloudfront:Update*",
          "cloudfront:Delete*",
          "cloudfront:Tag*",
          "cloudfront:Untag*",
          "cloudfront:List*",
        ]
        Resource = "*"
      },
      {
        # Scoped to this app's own role/policy naming convention — NOT "*".
        # Lets this role manage its own future updates via Terraform without
        # being able to touch unrelated IAM roles/policies in the account.
        Sid    = "OwnRoleManagement"
        Effect = "Allow"
        Action = [
          "iam:GetRole",
          "iam:GetRolePolicy",
          "iam:ListRolePolicies",
          "iam:ListAttachedRolePolicies",
          "iam:TagRole",
          "iam:UpdateAssumeRolePolicy",
          "iam:PutRolePolicy",
          "iam:DeleteRolePolicy",
        ]
        Resource = "arn:aws:iam::*:role/scrumpoker-*"
      },
    ]
  })
}
