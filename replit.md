# Executive Presence — AI Coaching Platform

## Overview

AI coaching platform that analyzes speakers across 11 (audio) or 15 (video) dimensions, scores them per the Gravitas Scoring Methodology v4.0, assigns tiers (Needs Focus / Developing / Strong / Distinguished), and generates per-dimension coaching feedback using Claude AI and gpt-audio.

## Architecture

pnpm workspace monorepo using TypeScript.

```
artifacts/
  api-server/   # Express 5 backend API (port 8080, served at /api)
  ep-app/       # React + Vite frontend (served at /)
  admin/        # Internal admin dashboard (served at /admin) — admin-only
lib/
  db/           # Drizzle ORM schema + PostgreSQL connection
  api-spec/     # OpenAPI 3.0 spec + Orval codegen config
  api-zod/      # Generated Zod schemas from OpenAPI
  api-client-react/  # Generated React Query hooks
  integrations-anthropic-ai/  # Anthropic Claude SDK wrapper
```

## Stack

- **Monorepo**: pnpm workspaces
- **Node.js**: 24
- **TypeScript**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: JWT (jsonwebtoken + bcryptjs), stored in localStorage
- **AI**: Anthropic Claude (`claude-sonnet-4-6`) for coaching text
- **Validation**: Zod, drizzle-zod
- **API codegen**: Orval (OpenAPI → React Query hooks + Zod schemas)
- **Frontend**: React 19, Vite, Tailwind CSS v4, shadcn/ui components
- **Charts**: Recharts (radar chart, line chart for progress)

## Scoring Methodology v4.0

15 dimensions across 4 pillars:
- Pillar 1 — Voice Quality (20% video / 25% audio): Articulation, Projection, Vocal Tone, Vocal Steadiness
- Pillar 2 — Vocal Delivery (25% / 30%): Intonation, Pace, Pausing, Breath Control
- Pillar 3 — Thought Clarity (35% / 45%): Confidence Language, Structure, Conciseness
- Pillar 4 — Physical Delivery (20%, video only): Eye Contact, Facial Expression, Gestures, Posture

Tier thresholds (v4.0): Needs Focus 1.0–3.9 | Developing 4.0–6.4 | Strong 6.5–8.4 | Distinguished 8.5–10.0

Gating rules:
- Rule 1: If any anchor dimension (Structure, Vocal Tone, Intonation, + Eye Contact for video) scores ≤3, composite is capped at 6.4
- Rule 2: Distinguished gate — all anchors must be ≥7 AND ≥10/15 (video) or ≥8/11 (audio) dims must be ≥7

Context classification: 5 categories from prompt text, each with its own ideal WPM range

Sessions scored under v4.0 are tagged `methodologyVersion: "4.0"`. Legacy sessions (v3.0) are shown with a version notice.

## Gravitas Brand Tokens

- Background: Warm Cream #FBF7F2
- Text: Midnight #0F1B2D
- CTA: Amber #F0953E
- Accent: Terracotta #C84A18
- Tier colors: Needs Focus #EDE8E2 | Developing #F0953E | Strong #C84A18 | Distinguished #0F1B2D
- Fonts: Cormorant Garamond (display), Inter (body), DM Mono (data)

## Key Commands

- `pnpm run typecheck` — full typecheck
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas
- `pnpm --filter @workspace/db run push` — push DB schema changes
- `pnpm --filter @workspace/api-server run build` — build API server

## Database Schema

Tables: `users`, `sessions`, `dimension_scores`, `diagnostic_metrics`

## API Routes

All routes are prefixed with `/api`:
- `POST /v1/auth/signup` — create account
- `POST /v1/auth/login` — sign in
- `POST /v1/auth/logout` — sign out
- `POST /v1/auth/change-password` — change password
- `GET/PATCH /v1/users/me` — profile management
- `POST /v1/users/me/onboarding` — complete onboarding
- `GET /v1/users/me/export` — data export
- `POST /v1/sessions` — create session
- `GET /v1/sessions` — list sessions
- `GET /v1/sessions/:id` — get session with dimension scores
- `DELETE /v1/sessions/:id` — delete session
- `POST /v1/sessions/:id/upload` — trigger async scoring
- `GET /v1/sessions/:id/status` — poll processing status
- `GET /v1/sessions/progress` — completed sessions for chart
- `POST /v1/sessions/test-audio` — audio quality check
- `POST /v1/sessions/test-video` — video quality check
- `GET /v1/prompts` — list practice prompts
- `GET /v1/prompts/random` — get random prompt
- `GET /v1/admin/stats` — platform aggregate stats (admin only)
- `GET /v1/admin/users` — all users with session counts (admin only)
- `GET /v1/admin/users/:id` — user detail + all sessions (admin only)
- `GET /v1/admin/sessions/:id` — session detail with scores/transcript (admin only)
- `PATCH /v1/admin/users/:id` — grant/revoke admin flag (admin only)

## Admin Dashboard

Served at `/admin`. Auth guard: JWT must contain `isAdmin: true`.
Granting admin: `UPDATE users SET is_admin = true WHERE email = 'you@example.com';`

Pages:
- `/admin/` — stats overview (users, sessions, avg score, recording time)
- `/admin/users` — searchable user table with session counts + avg scores
- `/admin/users/:id` — user detail, all sessions, grant/revoke admin toggle
- `/admin/sessions/:id` — full session detail, dimension scores with bars, transcript, feedback

## Frontend Pages

- `/login`, `/signup` — auth
- `/onboarding` — 3-step role/context/setup wizard
- `/dashboard` — stats overview + recent sessions
- `/record` — multi-step session recording (setup → prompt → recording → processing → done)
- `/history` — all sessions with delete
- `/sessions/:id` — detailed results with radar chart + per-dimension coaching
- `/progress` — composite score trend chart with tier reference lines
- `/settings` — profile, password, data export, sign out
