output "websocket_endpoint" {
  description = "wss:// URL clients connect to (includes the stage path)"
  value       = "wss://${aws_apigatewayv2_api.ws.id}.execute-api.${var.aws_region}.amazonaws.com/${aws_apigatewayv2_stage.this.name}"
}

output "api_id" {
  value = aws_apigatewayv2_api.ws.id
}

output "lambda_exec_role_arn" {
  value = aws_iam_role.lambda_exec.arn
}

output "lambda_exec_role_name" {
  value = aws_iam_role.lambda_exec.name
}

output "connect_function_name" {
  value = aws_lambda_function.connect.function_name
}

output "disconnect_function_name" {
  value = aws_lambda_function.disconnect.function_name
}

output "message_function_name" {
  value = aws_lambda_function.message.function_name
}
