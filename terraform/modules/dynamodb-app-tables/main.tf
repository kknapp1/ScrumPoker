/**
 * App data tables for the WebSocket backend (Phase 2): connections, rooms,
 * votes. Kept in their own module, separate from compute (Lambda/API
 * Gateway), since tables have a different lifecycle — Lambda code changes
 * shouldn't risk touching table definitions in the same plan diff.
 *
 * Names follow the scrumpoker-<environment>-<table> convention already used
 * for the IAM role in modules/github-deploy-role, so the GitHub Actions
 * deploy role's IAM policy can scope DynamoDB permissions to this naming
 * pattern.
 */

resource "aws_dynamodb_table" "connections" {
  name         = "scrumpoker-${var.environment}-connections"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "connectionId"

  attribute {
    name = "connectionId"
    type = "S"
  }

  attribute {
    name = "roomId"
    type = "S"
  }

  global_secondary_index {
    name            = "roomId-index"
    hash_key        = "roomId"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = var.tags
}

resource "aws_dynamodb_table" "rooms" {
  name         = "scrumpoker-${var.environment}-rooms"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "roomId"

  attribute {
    name = "roomId"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = var.tags
}

resource "aws_dynamodb_table" "votes" {
  name         = "scrumpoker-${var.environment}-votes"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "roomId"
  range_key    = "connectionId"

  attribute {
    name = "roomId"
    type = "S"
  }

  attribute {
    name = "connectionId"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = var.tags
}
