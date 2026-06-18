# setup-git.ps1 — Run once to initialize the git repo and push to GitHub.
# Open PowerShell in C:\YLApplicationDevelopment\ScrumPoker and run:
#   .\setup-git.ps1

$ErrorActionPreference = "Stop"
$repoUrl = "https://github.com/kknapp1/ScrumPoker.git"

Write-Host "Removing partial .git directory..." -ForegroundColor Cyan
if (Test-Path ".git") {
    Remove-Item -Recurse -Force ".git"
}

Write-Host "Initializing git repo..." -ForegroundColor Cyan
git init -b main

Write-Host "Configuring user..." -ForegroundColor Cyan
git config user.email "knapptech@gmail.com"
git config user.name "Kenny Knapp"

Write-Host "Adding remote origin..." -ForegroundColor Cyan
git remote add origin $repoUrl

Write-Host "Staging all files..." -ForegroundColor Cyan
git add -A

Write-Host "Creating initial commit..." -ForegroundColor Cyan
git commit -m "Phase 1: project scaffold, React UI, theme system, Terraform, GitHub Actions

- React + Vite frontend with Fibonacci card deck
- Name entry modal, lobby page, room page with voting UI
- Reveal / reset mechanics, results display with avg/median
- CSS custom properties theme system (themes/default.css)
- Terraform: S3 + CloudFront frontend hosting (us-east-2)
- Terraform: bootstrap module for remote state
- GitHub Actions: deploy-sandbox.yml (merge to main)
- GitHub Actions: deploy-prod.yml (placeholder, gated)
- Backend Lambda stubs: connect, disconnect, message handlers
- DynamoDB helpers and broadcast utility (Phase 2 ready)
- docs/ARCHITECTURE.md and docs/FUTURE_FEATURES.md"

Write-Host ""
Write-Host "Ready to push. Run:" -ForegroundColor Green
Write-Host "  git push -u origin main" -ForegroundColor Yellow
Write-Host ""
Write-Host "You will be prompted for your GitHub credentials." -ForegroundColor Gray
Write-Host "Use a Personal Access Token (not your password)." -ForegroundColor Gray
Write-Host "Create one at: https://github.com/settings/tokens (needs 'repo' scope)" -ForegroundColor Gray
