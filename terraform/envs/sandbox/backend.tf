/**
 * Remote state backend.
 *
 * The bucket is created once per AWS account by terraform/bootstrap and has
 * a random suffix (scrum-poker-<randomid>), so it can't be hardcoded here.
 * Supply it at init time:
 *
 *   terraform init -backend-config="bucket=scrum-poker-<randomid>"
 *
 * (the bootstrap `bucket_name` output gives you the exact value)
 */
terraform {
  backend "s3" {
    key            = "state/terraform.tfstate"
    region         = "us-east-2"
    dynamodb_table = "scrum-poker-tflock"
    encrypt        = true
  }
}
