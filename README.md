# Pachanga Fantasy

Private amateur-football fantasy for a group of friends who play together. Functional behaviour lives in [`requirements.md`](./requirements.md). Delivery plan lives in [`TODO.md`](./TODO.md).

## Setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL` and `JWT_SECRET`.
2. Create a PostgreSQL database.
3. Install dependencies: `npm install`
4. Apply schema: `npm run db:push` (or `npm run db:generate` then `npm run db:migrate`)
5. Optional demo data: `npm run db:seed`

## Run

- Development: `npm run dev` (http://localhost:5000 by default, override with `PORT`)
- Production: `npm run build` then `npm start` (serves the client from `dist/public`)

## Test

- `npm test` — unit, API, smoke, and the full loop
- `npm run test:unit` — domain rules, no database
- `npm run test:api` — HTTP tests against a disposable `pachanga_test` schema
- `npm run test:e2e` — full loop plus negative paths
- `npm run check` — TypeScript
- `npm run lint` — ESLint

See [`docs/testing.md`](./docs/testing.md). Pull requests run the same checks in GitHub Actions.

## Architecture

See [`docs/architecture.md`](./docs/architecture.md). One frontend (React), one Express API, one PostgreSQL database, schema in `shared/schema.ts`.
