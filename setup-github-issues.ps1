# setup-github-issues.ps1
# Creates all GitHub issues for the ScrumPoker project.
#
# Usage:
#   $env:GITHUB_TOKEN = "ghp_yourTokenHere"
#   .\setup-github-issues.ps1
#
# Requires a PAT with 'repo' scope.
# Create one at: https://github.com/settings/tokens

$repo  = "kknapp1/ScrumPoker"
$token = $env:GITHUB_TOKEN
if (-not $token) {
    Write-Error "Set GITHUB_TOKEN environment variable first."
    exit 1
}

$headers = @{
    Authorization = "Bearer $token"
    Accept        = "application/vnd.github+json"
    "X-GitHub-Api-Version" = "2022-11-28"
}

function New-Issue($title, $body, $labels) {
    $payload = @{ title = $title; body = $body; labels = $labels } | ConvertTo-Json
    $resp = Invoke-RestMethod `
        -Method Post `
        -Uri "https://api.github.com/repos/$repo/issues" `
        -Headers $headers `
        -Body $payload `
        -ContentType "application/json"
    Write-Host "  Created #$($resp.number): $title" -ForegroundColor Green
    Start-Sleep -Milliseconds 300  # avoid rate limiting
}

# ── Create labels first ──────────────────────────────────────────────────────

$labels = @(
    @{ name = "phase-1";  color = "0075ca"; description = "Phase 1: Foundation & Static UI" },
    @{ name = "phase-2";  color = "e4e669"; description = "Phase 2: Real-time Backend" },
    @{ name = "phase-3";  color = "d93f0b"; description = "Phase 3: Room Settings" },
    @{ name = "phase-4";  color = "0e8a16"; description = "Phase 4: Polish" },
    @{ name = "future";   color = "cfd3d7"; description = "Future backlog — not yet scoped" },
    @{ name = "infra";    color = "5319e7"; description = "Infrastructure / Terraform" },
    @{ name = "frontend"; color = "fbca04"; description = "Frontend / React" },
    @{ name = "backend";  color = "006b75"; description = "Backend / Lambda" }
)

Write-Host "Creating labels..." -ForegroundColor Cyan
foreach ($label in $labels) {
    try {
        $payload = $label | ConvertTo-Json
        Invoke-RestMethod `
            -Method Post `
            -Uri "https://api.github.com/repos/$repo/labels" `
            -Headers $headers `
            -Body $payload `
            -ContentType "application/json" | Out-Null
        Write-Host "  Label: $($label.name)" -ForegroundColor Green
    } catch {
        Write-Host "  Label '$($label.name)' already exists or error — skipping." -ForegroundColor Yellow
    }
    Start-Sleep -Milliseconds 200
}

# ── Phase 1 issues ───────────────────────────────────────────────────────────

Write-Host "`nCreating Phase 1 issues..." -ForegroundColor Cyan

New-Issue `
    "[P1] Project scaffold and repository initialization" `
    "Set up React+Vite frontend, backend skeleton, Terraform structure, and .github/workflows. Initialize git and push to this repo." `
    @("phase-1", "infra")

New-Issue `
    "[P1] Static card UI with local state" `
    "Implement the core poker UI: lobby page, name entry modal, room page with Fibonacci card grid, reveal/reset mechanics, results display (avg/median), participant list." `
    @("phase-1", "frontend")

New-Issue `
    "[P1] Theme system (CSS custom properties)" `
    "All colors, fonts, and spacing defined as CSS variables in \`src/themes/default.css\`. Swapping themes = swapping one import in main.jsx. No component changes needed." `
    @("phase-1", "frontend")

New-Issue `
    "[P1] Terraform: frontend hosting (S3 + CloudFront)" `
    "S3 bucket (private) + CloudFront distribution for SPA hosting in us-east-2. SPA routing (404→index.html). Bootstrap module for remote state." `
    @("phase-1", "infra")

New-Issue `
    "[P1] GitHub Actions: sandbox deploy on merge to main" `
    "deploy-sandbox.yml: install, build frontend, terraform init+apply, sync to S3, invalidate CloudFront. Requires AWS_DEPLOY_ROLE_ARN secret in the sandbox environment." `
    @("phase-1", "infra")

# ── Phase 2 issues ───────────────────────────────────────────────────────────

Write-Host "`nCreating Phase 2 issues..." -ForegroundColor Cyan

New-Issue `
    "[P2] DynamoDB schema + Terraform" `
    "Create three tables via Terraform: \`connections\` (PK: connectionId, GSI: roomId-index), \`rooms\` (PK: roomId), \`votes\` (PK: roomId, SK: connectionId). All with 24h TTL." `
    @("phase-2", "infra", "backend")

New-Issue `
    "[P2] Lambda WebSocket handlers" `
    "Implement \`\$connect\`, \`\$disconnect\`, and \`sendmessage\` handlers. connect: join/create room, enforce 50-participant limit, send ROOM_STATE. message: route VOTE, REVEAL, RESET, UPDATE_STORY. disconnect: clean up and notify room." `
    @("phase-2", "backend")

New-Issue `
    "[P2] API Gateway WebSocket API via Terraform" `
    "Create WebSocket API with \$connect, \$disconnect, sendmessage routes. Wire Lambda integrations. Add stage (sandbox). Add Lambda permission for API Gateway invocation." `
    @("phase-2", "infra", "backend")

New-Issue `
    "[P2] Frontend WebSocket integration" `
    "Replace useLocalRoom with useWebSocketRoom hook. Connect to API Gateway WS endpoint on room load. Handle all server events: ROOM_STATE, PARTICIPANT_JOINED, PARTICIPANT_LEFT, VOTE_CAST, VOTES_REVEALED, ROUND_RESET. Remove Phase 1 local-only notice. Handle reconnect on disconnect." `
    @("phase-2", "frontend")

New-Issue `
    "[P2] 50-participant limit enforcement" `
    "The \$connect handler rejects the 51st participant with 403. Frontend should detect this and display a clear error. See future issue for view-only mode upgrade." `
    @("phase-2", "backend", "frontend")

# ── Phase 3 issues ───────────────────────────────────────────────────────────

Write-Host "`nCreating Phase 3 issues..." -ForegroundColor Cyan

New-Issue `
    "[P3] Room settings: card deck customization" `
    "Allow room creator to choose deck: Fibonacci (default), T-shirt sizes, powers of 2. Store deckKey in DynamoDB rooms table. Broadcast deck change to all participants." `
    @("phase-3", "frontend", "backend")

New-Issue `
    "[P3] Moderator controls: gate reveal and reset" `
    "First user to join a room is the moderator (stored as moderatorConnectionId in DynamoDB). Add settings to allow/deny others from revealing or resetting. Phase 1/2 allows anyone; Phase 3 gates it." `
    @("phase-3", "frontend", "backend")

New-Issue `
    "[P3] Show average and median post-reveal" `
    "After reveal, display avg and median of numeric votes. Already scaffolded in ResultsDisplay.jsx and useLocalRoom.js. Needs server-side vote data from VOTES_REVEALED event." `
    @("phase-3", "frontend")

# ── Phase 4 issues ───────────────────────────────────────────────────────────

Write-Host "`nCreating Phase 4 issues..." -ForegroundColor Cyan

New-Issue `
    "[P4] WebSocket reconnect / rejoin handling" `
    "Detect connection drop. Auto-reconnect with exponential backoff. Rejoin room with same userName. Restore vote state if voting is still open." `
    @("phase-4", "frontend")

New-Issue `
    "[P4] Mobile-responsive layout" `
    "Ensure lobby, name entry modal, room page, and card grid are usable on mobile (320px+). Cards should wrap cleanly. Navigation should not overflow." `
    @("phase-4", "frontend")

New-Issue `
    "[P4] Vote history within active session" `
    "Accumulate round results (story name + votes + timestamp) in memory during a session. Display a history section below the active round. Add CSV export button." `
    @("phase-4", "frontend")

# ── Future backlog issues ─────────────────────────────────────────────────────

Write-Host "`nCreating future backlog issues..." -ForegroundColor Cyan

New-Issue `
    "[future] Google Analytics integration" `
    "Add GA4 tag to index.html (comment placeholder already in place). Use a GA4 Measurement ID environment variable. Consider cookie consent banner for compliance. See docs/FUTURE_FEATURES.md." `
    @("future", "frontend")

New-Issue `
    "[future] View-only mode for 51+ participants" `
    "When room is at 50-participant limit, allow additional connections as observers. Observers see votes but cannot submit. Upgrade \$connect handler in backend/handlers/connect.js — currently returns 403 for overflow connections." `
    @("future", "frontend", "backend")

New-Issue `
    "[future] Corporate / team theme support" `
    "When styling for a specific team: copy \`src/themes/default.css\`, update CSS variables, change the import in \`main.jsx\`. The theme system is already in place — this issue is to track the actual design work per team." `
    @("future", "frontend")

New-Issue `
    "[future] Gated production deployment workflow" `
    "Activate \`.github/workflows/deploy-prod.yml\`. Steps: create a 'production' GitHub Environment with required reviewer(s), create \`terraform/envs/production/\`, add AWS_DEPLOY_ROLE_ARN to production environment secrets." `
    @("future", "infra")

New-Issue `
    "[future] Jira / Linear story import" `
    "Add 'Import story' button on room page. OAuth or API token flow. Fetch active sprint stories and populate the story name field per round. See docs/FUTURE_FEATURES.md." `
    @("future", "frontend")

New-Issue `
    "[future] Vanity / persistent room IDs" `
    "Allow teams to bookmark a permanent room URL (e.g. /room/team-alpha). Requires persistent room record in DynamoDB (no TTL). Add room creation form with custom ID option." `
    @("future", "frontend", "backend")

Write-Host "`nAll issues created! View them at: https://github.com/$repo/issues" -ForegroundColor Green
