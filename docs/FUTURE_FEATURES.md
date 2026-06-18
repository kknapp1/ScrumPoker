# Future Features

Issues are tracked in GitHub. This doc gives rationale and notes.

## Google Analytics (Issue #TBD)

Add GA4 tag to `frontend/index.html` where the comment placeholder is.
Use a GA4 property. Consider cookie consent banner if required.

## View-only mode for 51+ participants (Issue #TBD)

When `MAX_PARTICIPANTS` (50) is reached, allow additional connections
as observers: they see votes but cannot submit one. The `$connect` handler
in `backend/handlers/connect.js` currently returns 403 — change to allow
the connection with an `isObserver: true` flag and filter from voting UI.

## Corporate / team themes (Issue #TBD)

Copy `frontend/src/themes/default.css` to a new file per team.
Change the import in `src/main.jsx`. All CSS custom properties are
documented in `default.css` — no component code changes needed.

## Gated production deployment (Issue #TBD)

See `.github/workflows/deploy-prod.yml`. Steps:
1. Create a "production" GitHub Environment with required reviewer(s)
2. Create `terraform/envs/production/` mirroring sandbox
3. Add `AWS_DEPLOY_ROLE_ARN` to the production environment secrets
4. Uncomment the release trigger in `deploy-prod.yml`

## Jira / Linear story import (Issue #TBD)

Add a "Import from Jira" button on the room page. OAuth flow or API token
stored per-user in localStorage. Fetches active sprint stories and populates
the story name field for each round.

## Vanity / persistent room IDs (Issue #TBD)

Allow team to bookmark a permanent room URL (e.g. /room/team-alpha).
Requires persistent room record — remove TTL for these rooms.

## Vote history export (Issue #TBD)

After a session, export results (story name + votes + timestamp) as CSV.
Frontend-only: accumulate round results in state, offer CSV download button.
