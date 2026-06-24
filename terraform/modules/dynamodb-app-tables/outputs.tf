output "connections_table_name" {
  value = aws_dynamodb_table.connections.name
}

output "connections_table_arn" {
  value = aws_dynamodb_table.connections.arn
}

output "connections_table_gsi_arn" {
  value = "${aws_dynamodb_table.connections.arn}/index/roomId-index"
}

output "rooms_table_name" {
  value = aws_dynamodb_table.rooms.name
}

output "rooms_table_arn" {
  value = aws_dynamodb_table.rooms.arn
}

output "votes_table_name" {
  value = aws_dynamodb_table.votes.name
}

output "votes_table_arn" {
  value = aws_dynamodb_table.votes.arn
}
