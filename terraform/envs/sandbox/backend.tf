/**
 * Remote state backend.
 *
 * After running terraform/bootstrap, paste the output values here:
 *   bucket = "<state_bucket output>"
 *   dynamodb_table = "<lock_table output>"
 */
terraform {
  backend "s3" {
    bucket         = "REPLACE_WITH_BOOTSTRAP_OUTPUT"
    key            = "sandbox/terraform.tfstate"
    region         = "us-east-2"
    dynamodb_table = "scrum-poker-tflock"
    encrypt        = true
  }
}
