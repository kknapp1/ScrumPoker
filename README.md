# Scrum Poker

Internal collaborative planning poker tool for agile sprint ceremonies.
No ads, no accounts required.

## Quick Start (local dev)

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

## Project Structure

```
ScrumPoker/
├── frontend/        React + Vite SPA
├── backend/         Lambda handlers (Node.js) — Phase 2
├── terraform/       Infrastructure as code
│   ├── bootstrap/   One-time state bucket setup
│   ├── modules/     Reusable modules
│   └── envs/        Per-environment config
│       └── sandbox/ Sandbox environment
├── .github/
│   └── workflows/   CI/CD (deploy on merge to main)
└── docs/            Architecture + future features
```

## First-Time AWS Setup

1. **Bootstrap Terraform state:**
   ```bash
   cd terraform/bootstrap
   terraform init && terraform apply
   ```
   Copy the `state_bucket` output into `terraform/envs/sandbox/backend.tf`.

2. **Create an IAM role for GitHub Actions** with OIDC trust for
   `token.actions.githubusercontent.com`. Attach permissions for S3, CloudFront,
   DynamoDB, Lambda, API Gateway, and IAM (for the deploy role).
   Add the role ARN as `AWS_DEPLOY_ROLE_ARN` in the GitHub repository's
   `sandbox` environment secrets.

3. **Push to main** — GitHub Actions will run Terraform and deploy the frontend.

## Environments

| Environment | Trigger | URL |
|-------------|---------|-----|
| sandbox | push to `main` | CloudFront output from Terraform |
| production | manual (future) | TBD |

## Theming

Swap `frontend/src/themes/default.css` for a custom theme file.
See `docs/ARCHITECTURE.md` for details.

## Contributing

See `docs/ARCHITECTURE.md` for system design.
Open issues are tracked in GitHub Issues.
