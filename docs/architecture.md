# Architecture

Pachanga is a single Express server that serves a React client and a REST API. PostgreSQL is the only database. `shared/schema.ts` is the only schema.

## Layout

- `client/` — React UI. Live routes: `/login`, `/register`, `/`, `/overview`, `/leagues`, `/league/:id`.
- `server/` — HTTP, persistence, boot.
- `shared/` — Drizzle schema, Zod insert types, domain functions used by both sides.
- `migrations/` — generated SQL (source of schema history).
- `docs/archive/` — historical documents, not current requirements.

## Server layers

1. `server/routes/*` — HTTP actions, one file per domain.
2. `server/middleware/auth.ts` — `requireAuth`, plus `isLeagueMember` / `isLeagueAdmin`. Missing membership checks are left as they were; Phase 2 closes them.
3. `server/repos/*` — persistence only.
4. `shared/domain/*` (re-exported from `server/domain/*`) — pure rules.

API tests use the same Postgres instance with `search_path=pachanga_test`, so they never truncate the development `public` schema.

Production static files are served from `dist/public` (Vite's client output). `npm start` will refuse to boot if that directory is missing.

## Page triage (Phase 1)

| Page / component | Decision |
|---|---|
| Match detail, stats submission, valuation close, add-player, admin stats | **Folded into LeagueHub in Phase 7.** |
| `Dashboard`, `CreateLeague`, `JoinLeague`, `LeagueDashboard`, `LeagueDetail`, `TierListPage`, `LineupPage`, `Results`, `CreateMatch` | **Deleted** — superseded by Overview / LeagueHub dialogs. |

## Vestigial columns (Phase 2)

`users.role`, `users.leagueId` remain in the schema and are unused for product rules. Do not use `users.role` for authorisation. `players.position` was dropped in Phase 2.

## Future schema note

A `votes` table existed only in the unused `db/schema/` copy. MVP/disappointment voting stays a future feature (`requirements.md` §23), not live schema.
