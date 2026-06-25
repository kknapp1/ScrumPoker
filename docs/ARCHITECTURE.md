# Architecture

## Overview

Scrum Poker is a serverless real-time collaborative planning tool hosted on AWS.

## Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React + Vite | SPA, hosted on S3 + CloudFront |
| Real-time | API Gateway WebSocket | Phase 2 |
| Compute | AWS Lambda (Node.js) | Phase 2 |
| Database | DynamoDB (on-demand) | Phase 2, 24h TTL |
| IaC | Terraform | State in S3 + DynamoDB lock |
| CI/CD | GitHub Actions | Deploy on merge to main |
| Region | us-east-2 | |

## Phase 1 (current)

Static React app. No backend. All state is local to the browser tab.
The Phase 1 notice in the UI communicates this clearly to users.

## Phase 2 — Real-time collaboration

```
Browser                API Gateway WS              Lambda              DynamoDB
  |── wss://connect?roomId=X&userName=Y ──>  $connect handler  ──>  saveConnection()
  |                                                              ──>  createRoom() if new
  |                                          <── ROOM_STATE ──────────
  |
  |── { type: "VOTE", value: "5" } ──────>  sendmessage handler ──> saveVote()
  |                                          <── broadcast VOTE_CAST to room
  |
  |── { type: "REVEAL" } ─────────────────>  sendmessage handler ──> getVotesByRoom()
  |                                          <── broadcast VOTES_REVEALED + vote map
```

## DynamoDB Tables (Phase 2)

### connections
- PK: `connectionId` (string)
- GSI: `roomId-index` on `roomId`
- TTL: `ttl` (24h from last activity)

### rooms
- PK: `roomId` (string)
- TTL: `ttl` (24h from last activity)

### votes
- PK: `roomId` (string), SK: `connectionId` (string)
- No TTL — cleaned up on RESET; parent room TTL handles stragglers

## Theming

All colors, fonts, and spacing are defined as CSS custom properties in
`frontend/src/themes/default.css`. `frontend/src/main.jsx` imports the bare
specifier `'theme-active'`, which `vite.config.js` aliases at build time to
`src/themes/<VITE_THEME>.css` (defaults to `default` if unset) — theme
selection is build-time config, not a runtime toggle, and no main.jsx edit
is needed to switch themes. To apply a corporate theme, create a new file
(e.g. `themes/acme-corp.css`), edit the variable values, and build with
`VITE_THEME=acme-corp`. No component code needs to change — components
only ever reference the CSS variables, never a literal color/font value.
See the README's Theming section for how this is wired into sandbox
deploys via the `SCRUM_POKER_THEME` GitHub Environment variable.

## Future: Google Analytics

Add the GA script tag to `frontend/index.html`. The comment marking the location
is already in place. See `docs/FUTURE_FEATURES.md`.
