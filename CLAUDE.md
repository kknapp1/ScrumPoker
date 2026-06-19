# ScrumPoker — agent notes

Internal collaborative planning poker tool. React + Vite frontend, Lambda
WebSocket backend (Node.js, Phase 2 — not yet wired into Terraform), AWS
infra via Terraform, deployed via GitHub Actions.

## Repo layout

```
frontend/        React + Vite SPA (npm install / npm run dev → localhost:3000)
backend/         Lambda handlers (connect/disconnect/message) — not yet deployed by Terraform
terraform/
  bootstrap/     Run ONCE per AWS account — creates the app bucket + lock table
  modules/       Reusable modules (frontend-hosting = S3 + CloudFront)
  envs/sandbox/  Per-environment config (only sandbox is active; production is a placeholder)
.github/workflows/
  deploy-sandbox.yml  Active CI/CD (push to main)
  deploy-prod.yml     Placeholder, manually gated, not wired to any terraform/envs/production yet
```

## AWS account / bucket model (current as of 2026-06-18)

One S3 bucket **per AWS account** (sandbox, test, prod each have their own),
named `scrum-poker-<randomid>` — the random suffix exists purely for
S3's global-uniqueness requirement. The **environment name is deliberately
not part of any bucket name or key prefix**, since the same Terraform config
is applied unmodified across accounts. Three key prefixes inside that one bucket:

```
scrum-poker-<randomid>/
  state/    Terraform remote state (terraform/bootstrap creates the bucket; envs/* write here via backend.tf)
  builds/   zip archives of frontend/dist, staged by CI before release
  deploy/   frontend static files served by CloudFront (this is the only prefix CloudFront/the public can reach)
```

Earlier iteration used a shared multi-app bucket (`young-life-terraform`,
`young-life-client-builds`, `young-life-client-deploy`) — abandoned because
it collided with existing AWS resources. Don't reintroduce that pattern.

**Terraform backend gotcha**: `backend "s3" {}` blocks cannot use variables.
The bucket name (which differs per account) is supplied via partial config:
`terraform init -backend-config="bucket=<value>"`. The `bucket_name` value
itself is a normal Terraform variable everywhere else (module inputs, etc.),
sourced from the `bucket_name` output of `terraform/bootstrap` for that account.

**frontend-hosting module**: does NOT create the S3 bucket — it references
the existing per-account bucket via a `data "aws_s3_bucket"` and only owns
objects/policy/CloudFront under its own `key_prefix` (`deploy`). Bucket-level
settings (versioning, public access block, encryption) are bootstrap's job.

## GitHub Actions

`deploy-sandbox.yml` reads the per-account bucket name from a GitHub
**Environment variable** `vars.SCRUM_POKER_BUCKET` (Settings > Environments >
sandbox > Variables) — set this manually after running bootstrap for that
account. It's exposed as both `env.SCRUM_POKER_BUCKET` (used directly in s3
paths and `-backend-config`) and `TF_VAR_bucket_name` (picked up automatically
by Terraform).

Flow: build frontend → zip `dist/` → upload to `builds/<sha>.zip` → terraform
apply → download that same zip from `builds/` → extract → sync to `deploy/`
→ invalidate CloudFront. This build/release split is intentional (the
artifact that gets deployed is the exact one that was built, not a re-build).

## AWS SSO profiles (local dev, ~/.aws/config)

- `default` — legacy-style SSO config, no `sso-session` block
- `prod-admin`, `test-admin`, `sandbox-admin` — newer `sso-session` style,
  one per account. Login with `aws sso login --profile <name>`, then
  `$env:AWS_PROFILE = "<name>"` (PowerShell) before running terraform.

## Conventions

- All taggable AWS resources get `Owner = "Kenny Knapp"` alongside
  `Project = "scrum-poker"` / `ManagedBy = "terraform"`.
- Use `@vitejs/plugin-react` (stable), not `@vitejs/plugin-react-oxc`
  (experimental, lagged behind the pinned `vite@^8` for peer deps and broke
  `npm install`). If bumping vite major versions, re-check this plugin's
  peer dependency range first.
- `terraform fmt -recursive` and `terraform validate` (per directory: each
  of bootstrap/, modules/frontend-hosting/, envs/sandbox/ is validated
  independently — they're separate root modules / use `terraform init
  -backend=false` for validation without touching real state).

## Known gaps / not-yet-done

- `deploy-prod.yml` and `terraform/envs/production` don't exist yet — sandbox
  is the only live environment.
- Backend Lambda handlers (`backend/`) have no Terraform resources yet (no
  Lambda, API Gateway, or DynamoDB app table in `modules/` or `envs/`) —
  only `connect.js`/`disconnect.js`/`message.js` exist as code.
- The GitHub Actions deploy role and its IAM policy were created manually
  in the AWS console (not in Terraform) — check whether a
  `terraform/modules/github-deploy-role` (or similar) exists before assuming
  it's still manual; if it's been imported, prefer that over recreating it.
