# Deploy

Pachanga is one Node process and one PostgreSQL database. `npm start` serves the API and the Vite client from `dist/public`. It does **not** apply SQL migrations.

## Required environment

Copy `.env.example` to `.env`. Boot needs:

- `DATABASE_URL` — Postgres. The database may live on another host.
- `JWT_SECRET` — long random string
- `NODE_ENV=production`
- `PORT` — defaults to 5000

## Optional environment

| Variable | Default | Effect when empty / false |
|---|---|---|
| `PUBLIC_URL` | (empty) | Verify emails use `http://localhost:$PORT` |
| `STORAGE_DIR` | `uploads` | Avatars are files under this directory (`$STORAGE_DIR/avatars`) |
| `SMTP_HOST` (and related `SMTP_*`) | empty | Register returns `503 EMAIL_NOT_CONFIGURED` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | empty | `/api/auth/google` returns `501`; the Google button is hidden |
| `PAYMENTS_ENABLED` | `false` | Checkout and webhook return `501 PAYMENTS_DISABLED`; `/billing` stays read-only |
| `ADS_ENABLED` | `false` | `GET /api/auth/features` reports `ads: false`; ad slots render nothing |
| `FEATURE_DEFAULT_PLAN` | `free` | Used when a billing account has no active subscription |
| `CORS_ORIGINS` | empty | Same-origin only. Set a comma-separated list when a packaged WebView calls the API |
| `ANALYTICS_PASSCODE` | `2026` | Unlocks `GET /analytics` (no nav link). Send as `X-Analytics-Passcode`. Change this in production. |

Treat `false`, `0`, and empty as off for boolean flags. Only `true` / `1` / `yes` turn them on.

## Schema updates

`npm start` does not migrate. Apply new SQL from `migrations/` in order.

If this server’s Drizzle journal is incomplete (typical after a 1.0 → 2.0 copy), **do not** run `npm run db:migrate` — it will try to replay `0000`. Apply the missing files with `psql -f`, the same way 0010–0013 were applied:

```bash
psql "$DATABASE_URL" -f migrations/0014_membership_join_open.sql
psql "$DATABASE_URL" -f migrations/0015_auth_email_identities.sql
psql "$DATABASE_URL" -f migrations/0016_billing_accounts.sql
psql "$DATABASE_URL" -f migrations/0017_password_reset_tokens.sql
```

The traction dashboard is only at `/analytics`. It is not linked from the product. Unlock with `ANALYTICS_PASSCODE` (default `2026`). The page shows aggregates only — no emails, usernames, or invite codes.

## Build and run

```bash
npm ci
npm run build
NODE_ENV=production npm start
```

`npm start` refuses to boot if `dist/public` is missing.

Avatars are written under `STORAGE_DIR`. Keep that directory on a persistent volume. Object storage is a later swap of the avatar store, not a requirement to boot.

See [architecture.md](./architecture.md) for how API, static files, disk, and Postgres can split later. See [mobile.md](./mobile.md) for packaging the same client.
