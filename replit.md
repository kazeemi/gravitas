# Executive Presence — AI Coaching Platform

## Overview

AI coaching platform that analyzes speakers across 6 (audio) or 10 (video) dimensions, scores them per the EP Methodology v3.0, assigns tiers (Emerging/Developing/Strong/Distinguished), and generates per-dimension coaching feedback using Claude AI.

## Architecture

pnpm workspace monorepo using TypeScript.

```
artifacts/
  api-server/   # Express 5 backend API (port 8080, served at /api)
  ep-app/       # React + Vite frontend (served at /)
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

## Key Methodology Rules (PRD §8)

- 6 audio dimensions: vocal_clarity, pace_rhythm, volume_projection, filler_words, structure, confidence_language
- 10 video dimensions: above + presence_engagement, eye_contact, gesture_movement, professional_appearance
- Tiers: Needs Focus (1-3), Developing (4-5), Strong (6-7), Distinguished (8-10)
- Distinguished composite capped at 8.0 if any gating dimension (vocal_clarity, confidence_language, structure, presence_engagement) scores 1-3
- No raw audio/video is ever persisted — scoring uses heuristic metrics + optional transcript

## Design Tokens (PRD §10.1)

- Needs Focus: #E24B4A (red)
- Developing: #BA7517 (amber)
- Strong: #0F6E56 (teal)
- Distinguished: #534AB7 (purple)
- Font: Inter

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

## Frontend Pages

- `/login`, `/signup` — auth
- `/onboarding` — 3-step role/context/setup wizard
- `/dashboard` — stats overview + recent sessions
- `/record` — multi-step session recording (setup → prompt → recording → processing → done)
- `/history` — all sessions with delete
- `/sessions/:id` — detailed results with radar chart + per-dimension coaching
- `/progress` — composite score trend chart with tier reference lines
- `/settings` — profile, password, data export, sign out
