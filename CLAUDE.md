# ScrumPoker — agent notes

Internal collaborative planning poker tool. React + Vite frontend, Lambda
WebSocket backend (Node.js, Phase 2 — deployed via Terraform), AWS infra via
Terraform, deployed via GitHub Actions.

## Repo layout

```
frontend/        React + Vite SPA (npm install / npm run dev → localhost:3000)
backend/         Lambda handlers (connect/disconnect/message), deployed via
                 terraform/modules/websocket-backend (archive_file zip at apply time)
terraform/
  bootstrap/     Run ONCE per AWS account, MANUALLY — creates the app bucket,
                 lock table, AND the GitHub Actions deploy role (see below)
  modules/       Reusable modules (frontend-hosting, dynamodb-app-tables,
                 websocket-backend, github-deploy-role)
  envs/sandbox/  Per-environment config (only sandbox is active; production is a placeholder)
.github/workflows/
  deploy-sandbox.yml  Active CI/CD (push to main)
  deploy-prod.yml     Placeholder, manually gated, not wired to any terraform/envs/production yet
```

## IAM architecture: deploy role lives in bootstrap, not envs/<env>

The GitHub Actions deploy role (`modules/github-deploy-role`) is created and
managed **only** by `terraform/bootstrap`, run manually with admin
credentials — never by `envs/<env>`, which is what CI actually runs.

**Why**: a Terraform run can't safely grant itself a permission it needs in
the same plan/apply — granting a permission and immediately depending on it
either forces a circular resource-creation order (if the grant references
the new resource's ARN) or races IAM's eventual consistency (if it doesn't).
Both failure modes were hit repeatedly while building out Phase 2's
DynamoDB/Lambda/API Gateway resources. The fix is structural: the role CI
assumes is never the role CI's own Terraform run modifies.

**Practical implications**:
- If `envs/<env>` ever needs a new AWS permission (new resource type, new
  action), add it to `modules/github-deploy-role`'s policy, then **run
  `terraform/bootstrap` manually** (`sandbox-admin` SSO or equivalent) to
  apply it — *before* pushing the `envs/<env>` change that needs it. CI
  cannot grant its own role permissions.
- `envs/<env>` only ever manages app resources (frontend hosting, DynamoDB
  app tables, Lambda, API Gateway) — it has no `module "deploy_role"` block
  and no `aws_iam_role`/`aws_iam_role_policy` resources of its own.
- The role's ARN is configured as the `AWS_DEPLOY_ROLE_ARN` GitHub secret
  manually (not wired through Terraform outputs into CI), for the same
  reason: keep the role's lifecycle fully outside what CI can touch.
- Resources `envs/<env>` creates that themselves need IAM permissions (e.g.
  the Lambda exec role `modules/websocket-backend` creates and attaches
  policies to) are independent from each other in Terraform's graph by
  default — no automatic ordering. This hasn't needed a `depends_on` fix
  since the deploy role moved to bootstrap (nothing in `envs/<env>` grants
  permissions to itself anymore), but watch for it if a future module needs
  another module's resources to exist before it can safely proceed.

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

Same pattern for `vars.SCRUM_POKER_APPLICATION_TAG` — bootstrap's
`application_tag` output (a JSON object like `{"awsApplication":"arn:..."}`),
exposed as `TF_VAR_application_tag` so every resource in `envs/<env>`
associates with the `scrum-poker` AppRegistry Application (unified cost/usage
tracking in AWS's myApplications console). Both of these per-account GitHub
Environment variables need to be (re)set manually after bootstrap creates or
updates the bucket/Application for a given account.

Flow: install backend deps (`npm ci` — needed on disk for Terraform's
`archive_file` to zip into the Lambda package) → terraform apply (creates/
updates DynamoDB tables, Lambda, API Gateway; outputs `websocket_endpoint`)
→ **then** build frontend with `VITE_WS_ENDPOINT` from that output → zip
`dist/` → upload to `builds/<sha>.zip` → download that same zip from
`builds/` → extract → sync to `deploy/` → invalidate CloudFront. Terraform
apply intentionally happens *before* the frontend build (not after, as in
Phase 1) since Vite bakes `VITE_*` env vars in at build time and the
WebSocket URL doesn't exist until Terraform creates it. This build/release
split is intentional (the artifact that gets deployed is the exact one that
was built, not a re-build).

## Frontend theming

Visual theme is selected at **build time**, not a runtime UI toggle.
`frontend/src/main.jsx` imports the bare specifier `'theme-active'`, which
`vite.config.js` aliases to `src/themes/<VITE_THEME>.css` (defaults to
`default` if `VITE_THEME` is unset). In CI, `deploy-sandbox.yml` sources
`VITE_THEME` from the GitHub Environment variable `vars.SCRUM_POKER_THEME`
(same per-environment-variable pattern as `SCRUM_POKER_BUCKET` — unset
today, so sandbox currently builds the default theme).

To add a new theme: copy `frontend/src/themes/default.css`, change the
CSS variable values (component styles reference only these variables —
never hardcode a brand color directly in a component's `.module.css`;
that defeats the whole mechanism, and happened once already with a
literal `rgba(37, 99, 235, ...)` focus-ring color baked into three
component files before `--color-focus-ring` existed as a variable).
`themes/younglife.css` is a real second theme (Young Life's actual brand
colors/fonts, pulled from younglife.org's own page source) usable as a
reference.

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
  is the only live environment. When standing up a new account/environment,
  `terraform/bootstrap` must be run manually there first (creates the bucket,
  lock table, and that account's deploy role) before any CI push can deploy
  `envs/<env>`.
- Phase 3 (moderator-only reveal/reset, room settings) isn't implemented —
  `backend/handlers/message.js` has comments marking where that enforcement
  goes; currently any participant can reveal/reset.
- 50-participant limit: backend hard-rejects the 51st `$connect` with a 403;
  confirmed via load test (50 real connections + a 51st) that this works and
  doesn't disturb the other 50. The frontend can't distinguish a 403 from a
  generic connect failure (browsers don't expose HTTP status on a rejected
  WS handshake — confirmed empirically too: Node's `ws` library surfaces it
  as a `1006` close with no reason, and only logs the real 403 via a
  diagnostic-only error event not available to browser JS), so it shows a
  hedged "may be full or temporarily unavailable" message rather than a
  precise one. A more precise signal would require `connect.js` to accept
  the handshake and send an explicit error message before closing, rather
  than rejecting at `$connect` — not done, to avoid touching otherwise-
  stable handler code without a clear need.
- **Broadcast fan-out doesn't scale well as a room fills up.** `connect.js`
  broadcasts `PARTICIPANT_JOINED` to every existing connection on each join
  (`backend/lib/broadcast.js`'s `broadcastToRoom`, one `PostToConnection`
  call per existing participant, awaited within the `$connect` invocation).
  Load-tested at 50 concurrent joins: per-invocation duration grew roughly
  with room size (low seconds at ~10 participants, briefly hit the Lambda's
  original 10s timeout around 40-45) — load on the execute-api Management
  API compounds across overlapping in-flight `$connect` invocations as
  joins happen close together in time. Mitigated for now by raising
  `websocket-backend`'s Lambda `timeout` to 29s (API Gateway's own
  WebSocket integration timeout cap, not an arbitrary value) and
  `memory_size` to 256 for more throughput — verified all 50 connect
  successfully under that headroom. This is a mitigation, not a fix: the
  fan-out itself isn't batched or decoupled from the `$connect` critical
  path. Worth addressing properly (e.g. fire-and-forget broadcasts, or
  moving notification delivery off the connect path) if Phase 3 work
  touches this area or if real usage approaches the 50-participant ceiling
  with bursty joins.
