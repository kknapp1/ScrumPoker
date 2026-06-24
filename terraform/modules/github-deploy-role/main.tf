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
        Action   = ["s3:ListBucket", "s3:GetBucketLocation", "s3:GetBucketPolicy"]
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
        Sid    = "TerraformLockTable"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:DeleteItem",
          "dynamodb:DescribeTable",
          "dynamodb:DescribeContinuousBackups",
          "dynamodb:DescribeTimeToLive",
          "dynamodb:ListTagsOfResource",
        ]
        Resource = data.aws_dynamodb_table.tflock.arn
      },
      {
        # The app's own DynamoDB tables (connections/rooms/votes), distinct
        # from TerraformLockTable above. CreateTable/DeleteTable are needed
        # since this role provisions these tables itself via Terraform.
        Sid    = "AppDynamoDbTables"
        Effect = "Allow"
        Action = [
          "dynamodb:CreateTable",
          "dynamodb:DeleteTable",
          "dynamodb:DescribeTable",
          "dynamodb:DescribeContinuousBackups",
          "dynamodb:DescribeTimeToLive",
          "dynamodb:UpdateTimeToLive",
          "dynamodb:UpdateTable",
          "dynamodb:ListTagsOfResource",
          "dynamodb:TagResource",
          "dynamodb:UntagResource",
        ]
        Resource = length(var.app_table_arns) > 0 ? var.app_table_arns : ["arn:aws:dynamodb:*:*:table/scrumpoker-*"]
      },
      {
        # ListOpenIDConnectProviders has no resource-level permissions —
        # needed so this role's own Terraform run can read the shared
        # org-wide OIDC provider via data "aws_iam_openid_connect_provider".
        Sid      = "OidcProviderLookup"
        Effect   = "Allow"
        Action   = ["iam:ListOpenIDConnectProviders"]
        Resource = "*"
      },
      {
        Sid      = "OidcProviderRead"
        Effect   = "Allow"
        Action   = ["iam:GetOpenIDConnectProvider"]
        Resource = "arn:aws:iam::*:oidc-provider/token.actions.githubusercontent.com"
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
          "iam:CreateRole",
          "iam:DeleteRole",
          "iam:GetRole",
          "iam:GetRolePolicy",
          "iam:ListRolePolicies",
          "iam:ListAttachedRolePolicies",
          "iam:TagRole",
          "iam:UpdateAssumeRolePolicy",
          "iam:PutRolePolicy",
          "iam:DeleteRolePolicy",
          "iam:AttachRolePolicy",
          "iam:DetachRolePolicy",
        ]
        Resource = "arn:aws:iam::*:role/scrumpoker-*"
      },
      {
        Sid      = "PassLambdaExecRole"
        Effect   = "Allow"
        Action   = "iam:PassRole"
        Resource = "arn:aws:iam::*:role/scrumpoker-*"
        Condition = {
          StringEquals = { "iam:PassedToService" = "lambda.amazonaws.com" }
        }
      },
      {
        # Needed for Terraform to read/manage the AWSLambdaBasicExecutionRole
        # managed-policy attachment on the Lambda exec role.
        Sid      = "LambdaExecRoleManagedPolicyRead"
        Effect   = "Allow"
        Action   = ["iam:GetPolicy", "iam:GetPolicyVersion"]
        Resource = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
      },
      {
        # Lambda has resource-level permissions for these actions, scoped to
        # the scrumpoker-* naming convention used elsewhere in this file.
        Sid    = "AppLambdaManagement"
        Effect = "Allow"
        Action = [
          "lambda:CreateFunction",
          "lambda:DeleteFunction",
          "lambda:GetFunction",
          "lambda:GetFunctionConfiguration",
          "lambda:GetFunctionCodeSigningConfig",
          "lambda:GetFunctionEventInvokeConfig",
          "lambda:UpdateFunctionCode",
          "lambda:UpdateFunctionConfiguration",
          "lambda:AddPermission",
          "lambda:RemovePermission",
          "lambda:GetPolicy",
          "lambda:ListVersionsByFunction",
          "lambda:TagResource",
          "lambda:UntagResource",
          "lambda:ListTags",
        ]
        Resource = "arn:aws:lambda:*:*:function:scrumpoker-*"
      },
      {
        # API Gateway v2 (WebSocket) has no resource-level permissions for
        # most actions — same situation as CloudFrontManagement above, kept
        # account-wide per AWS's own documented limitation for this service.
        Sid    = "AppApiGatewayV2Management"
        Effect = "Allow"
        Action = [
          "apigateway:POST",
          "apigateway:GET",
          "apigateway:PUT",
          "apigateway:PATCH",
          "apigateway:DELETE",
          "apigateway:TagResource",
          "apigateway:UntagResource",
        ]
        Resource = "*"
      },
    ]
  })
}
