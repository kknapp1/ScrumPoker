/**
 * Phase 2 real-time backend: API Gateway WebSocket API + Lambda functions
 * (connect/disconnect/message) + the Lambda execution role. Bundled in one
 * module (not split with dynamodb-app-tables) because routes/integrations/
 * permissions all reference specific Lambda ARNs — Lambda and API Gateway
 * WebSocket only ever change together here.
 *
 * Handler code lives in backend/ (handlers/, lib/) and is already written —
 * this module only packages and deploys it. All three Lambdas share one zip
 * (archive_file over backend/), built at `terraform apply` time. CI must run
 * `npm ci --omit=dev` in backend/ before this module's plan/apply runs, since
 * archive_file just zips whatever is on disk.
 */

terraform {
  required_providers {
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}

data "archive_file" "backend" {
  type        = "zip"
  source_dir  = "${path.module}/../../../backend"
  output_path = "${path.module}/build/backend.zip"
  excludes    = ["package-lock.json", "handlers/*.test.js"]
}

# ── Lambda execution role ─────────────────────────────────────────

resource "aws_iam_role" "lambda_exec" {
  name = "scrumpoker-${var.environment}-lambda-exec"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_app_access" {
  name = "scrumpoker-${var.environment}-lambda-app-access"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AppTableAccess"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
        ]
        Resource = [
          var.connections_table_arn,
          var.connections_table_gsi_arn,
          var.rooms_table_arn,
          var.votes_table_arn,
        ]
      },
      {
        # Needed by backend/lib/broadcast.js's PostToConnectionCommand calls
        # to push messages to other connected clients.
        Sid      = "ManageWebSocketConnections"
        Effect   = "Allow"
        Action   = ["execute-api:ManageConnections"]
        Resource = "${aws_apigatewayv2_api.ws.execution_arn}/*"
      },
    ]
  })
}

# ── Lambda functions (share one zip, different handler entry points) ──
#
# timeout=29 is API Gateway's own hard cap on WebSocket integration timeout
# (not a Lambda limit) — set to the max useful value, not an arbitrary
# round number. Needed because connect.js's PARTICIPANT_JOINED broadcast
# fans out to every existing connection on each join; as a room approaches
# the 50-participant limit, that fan-out plus concurrent in-flight joins
# can push a single $connect invocation's duration into multiple seconds
# (observed during load testing: roughly linear growth with room size,
# occasionally exceeding the original 10s timeout around 40-45
# participants). memory_size=256 (up from 128) buys some headroom via
# Lambda's CPU-scales-with-memory behavior. This is a mitigation, not a
# fix — the underlying fan-out design doesn't batch or decouple broadcast
# delivery from the $connect critical path, so it remains a real
# scalability limitation worth addressing if Phase 3 work touches this
# area (e.g. fire-and-forget broadcasts, or moving notification delivery
# off the connect path entirely).

resource "aws_lambda_function" "connect" {
  function_name    = "scrumpoker-${var.environment}-connect"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "handlers/connect.handler"
  runtime          = "nodejs20.x"
  architectures    = ["arm64"]
  filename         = data.archive_file.backend.output_path
  source_code_hash = data.archive_file.backend.output_base64sha256
  timeout          = 29
  memory_size      = 256

  environment {
    variables = {
      CONNECTIONS_TABLE = var.connections_table_name
      ROOMS_TABLE       = var.rooms_table_name
      VOTES_TABLE       = var.votes_table_name
    }
  }

  tags = var.tags
}

resource "aws_lambda_function" "disconnect" {
  function_name    = "scrumpoker-${var.environment}-disconnect"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "handlers/disconnect.handler"
  runtime          = "nodejs20.x"
  architectures    = ["arm64"]
  filename         = data.archive_file.backend.output_path
  source_code_hash = data.archive_file.backend.output_base64sha256
  timeout          = 29
  memory_size      = 256

  environment {
    variables = {
      CONNECTIONS_TABLE = var.connections_table_name
      ROOMS_TABLE       = var.rooms_table_name
      VOTES_TABLE       = var.votes_table_name
    }
  }

  tags = var.tags
}

resource "aws_lambda_function" "message" {
  function_name    = "scrumpoker-${var.environment}-message"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "handlers/message.handler"
  runtime          = "nodejs20.x"
  architectures    = ["arm64"]
  filename         = data.archive_file.backend.output_path
  source_code_hash = data.archive_file.backend.output_base64sha256
  timeout          = 29
  memory_size      = 256

  environment {
    variables = {
      CONNECTIONS_TABLE = var.connections_table_name
      ROOMS_TABLE       = var.rooms_table_name
      VOTES_TABLE       = var.votes_table_name
    }
  }

  tags = var.tags
}

# ── API Gateway WebSocket API ─────────────────────────────────────

resource "aws_apigatewayv2_api" "ws" {
  name                       = "scrumpoker-${var.environment}-ws"
  protocol_type              = "WEBSOCKET"
  route_selection_expression = "$request.body.action"

  tags = var.tags
}

resource "aws_apigatewayv2_integration" "connect" {
  api_id                    = aws_apigatewayv2_api.ws.id
  integration_type          = "AWS_PROXY"
  integration_uri           = aws_lambda_function.connect.invoke_arn
  content_handling_strategy = "CONVERT_TO_TEXT"
}

resource "aws_apigatewayv2_integration" "disconnect" {
  api_id                    = aws_apigatewayv2_api.ws.id
  integration_type          = "AWS_PROXY"
  integration_uri           = aws_lambda_function.disconnect.invoke_arn
  content_handling_strategy = "CONVERT_TO_TEXT"
}

resource "aws_apigatewayv2_integration" "message" {
  api_id                    = aws_apigatewayv2_api.ws.id
  integration_type          = "AWS_PROXY"
  integration_uri           = aws_lambda_function.message.invoke_arn
  content_handling_strategy = "CONVERT_TO_TEXT"
}

resource "aws_apigatewayv2_route" "connect" {
  api_id    = aws_apigatewayv2_api.ws.id
  route_key = "$connect"
  target    = "integrations/${aws_apigatewayv2_integration.connect.id}"
}

resource "aws_apigatewayv2_route" "disconnect" {
  api_id    = aws_apigatewayv2_api.ws.id
  route_key = "$disconnect"
  target    = "integrations/${aws_apigatewayv2_integration.disconnect.id}"
}

# $default catches every inbound message regardless of body content —
# required because message.js does its own internal dispatch on the body's
# `type` field (VOTE/REVEAL/RESET/UPDATE_STORY), not a route-level discriminator.
resource "aws_apigatewayv2_route" "default" {
  api_id    = aws_apigatewayv2_api.ws.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.message.id}"
}

resource "aws_apigatewayv2_stage" "this" {
  api_id      = aws_apigatewayv2_api.ws.id
  name        = var.environment
  auto_deploy = true

  tags = var.tags
}

resource "aws_lambda_permission" "connect" {
  statement_id  = "AllowApiGatewayConnect"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.connect.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.ws.execution_arn}/*/$connect"
}

resource "aws_lambda_permission" "disconnect" {
  statement_id  = "AllowApiGatewayDisconnect"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.disconnect.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.ws.execution_arn}/*/$disconnect"
}

resource "aws_lambda_permission" "default" {
  statement_id  = "AllowApiGatewayDefault"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.message.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.ws.execution_arn}/*/$default"
}
