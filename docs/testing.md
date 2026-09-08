# Testing

`npm test` runs Vitest against `tests/unit`, `tests/api` and `tests/smoke`. Files run **serially** (`fileParallelism: false`) because API tests share one `pachanga_test` schema.

| Script | What it covers |
|---|---|
| `npm test` | Unit + API + smoke, including the full loop |
| `npm run test:unit` | Domain rules only (no database) |
| `npm run test:api` | HTTP tests against Postgres |
| `npm run test:e2e` | Full loop + negative paths (same runner; this is the product's definition of "fully working") |
| `npm run check` | TypeScript, zero errors |

API tests reuse `DATABASE_URL` (or `TEST_DATABASE_URL`) and isolate data in `pachanga_test`. That schema is created if missing and truncated between cases. The app user does not need `CREATEDB`.

The full-loop test is: register → create league → join → open valuation → rank → close → create match → join → build lineup → finish → submit statistics → score → both leaderboards stay frozen after later edits.

CI (`.github/workflows/ci.yml`) runs typecheck, lint, tests, the full-loop script, and `npm run build`, then checks `dist/public/index.html` exists.

## Demo data

`npm run db:seed` creates **Pachanga del Parque** if it is not already present.

- Owner: `carlos@pachanga.test` / `pachanga123`
- Members: lucia, miguel, ana @pachanga.test / same password
