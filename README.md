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

Theme is selected at **build time**, not a runtime toggle. Available themes
live in `frontend/src/themes/` (currently `default.css` and `younglife.css`).

- **Local dev / one-off build:** set `VITE_THEME` before building:
  ```bash
  VITE_THEME=younglife npm run build
  ```
  Omit it (or leave unset) to get `default`.

- **Sandbox deploys:** `deploy-sandbox.yml` reads `VITE_THEME` from the
  GitHub Environment variable `vars.SCRUM_POKER_THEME` (Settings >
  Environments > sandbox > Variables). Set it to a theme name (e.g.
  `younglife`) to make every future sandbox deploy use that theme, or leave
  it unset for `default`. Changing this variable doesn't redeploy anything
  by itself — push to `main`, or run the workflow manually
  (`gh workflow run deploy-sandbox.yml` or the Actions tab's "Run workflow"
  button), to bake the new theme into the next build.

To add a new theme, copy `frontend/src/themes/default.css`, edit the CSS
variable values, and use its filename (without `.css`) as `VITE_THEME`.
See `docs/ARCHITECTURE.md` for how the mechanism works.

## Versioning & Releases

Versions and GitHub Releases are fully automated by
[semantic-release](https://semantic-release.gitbook.io/) — there's no manual
version bump or tag-and-release step.

- **Commit messages must follow [Conventional Commits](https://www.conventionalcommits.org/)**
  (`feat:`, `fix:`, `chore:`, etc.) — enforced on every PR by the
  "Commit message lint" check (skipped for Dependabot PRs, since its
  auto-generated commit messages don't follow that format and that's not a
  useful signal about the dependency bump itself).
- **Releasing is just merging to `main`.** Every push to `main` runs
  `.github/workflows/release.yml`, which inspects commit messages since the
  last release and, if there's a `feat:`/`fix:`/breaking-change commit,
  bumps the version accordingly (`fix:` → patch, `feat:` → minor, a
  `BREAKING CHANGE:` footer → major), creates a git tag, and publishes a
  GitHub Release with auto-generated notes. A PR with only `chore:`/`docs:`/
  `test:` commits doesn't trigger a release.
  - This is independent of `deploy-sandbox.yml` — a release is a version
    tag + changelog entry, not a deploy. Sandbox deploys on every push to
    `main` regardless of whether that push also triggered a release.
- History before this was set up wasn't in Conventional Commits format, so
  releases are baselined at `v1.0.0`; semantic-release computes every
  version after that from real commit history.

## Contributing

See `docs/ARCHITECTURE.md` for system design.
Open issues are tracked in GitHub Issues.
