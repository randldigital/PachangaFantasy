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
| `SMTP_HOST` (and related `SMTP_*`) | empty | Register returns `503 EMAIL_NOT_CONFIGURED`. `SMTP_FROM` must be a **verified sender** at the provider, not the SMTP login (e.g. not `*@smtp-brevo.com`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | empty | `/api/auth/google` returns `501`; the Google button is hidden |
| `PAYMENTS_ENABLED` | `false` | Checkout and webhook return `501 PAYMENTS_DISABLED`; `/billing` stays read-only |
| `ADS_ENABLED` | `false` | `GET /api/auth/features` reports `ads: false`; ad slots render nothing |
| `ADSENSE_CLIENT` | empty | Publisher id (`ca-pub-…` or `pub-…`). Ignored unless `ADS_ENABLED`. Production `index.html` also has the matching `google-adsense-account` meta tag so Google can verify the site without login. |
| `ADSENSE_SLOT_OVERVIEW` / `ADSENSE_SLOT_HUB` | empty | **Required for Display fill.** Digits from AdSense → Ads → By ad unit → Get code (`data-ad-slot`). Empty ⇒ reserved box stays blank. |
| `ADS_TEST` | `false` | When true with ads on, units request Google test ads (`data-adtest=on`) |

Serve `client/public/ads.txt` at `https://your-domain/ads.txt` (built into `dist/public`). It must list your publisher id, e.g. `google.com, pub-…, DIRECT, f08c47fec0942fa0`.
| `FEATURE_DEFAULT_PLAN` | `free` | Used when a billing account has no active subscription |
| `CORS_ORIGINS` | empty | Same-origin only. Set a comma-separated list when a packaged WebView calls the API |
| `ANALYTICS_PASSCODE` | `2026` | Unlocks `GET /analytics` (no nav link). Send as `X-Analytics-Passcode`. Change this in production. |

Treat `false`, `0`, and empty as off for boolean flags. Only `true` / `1` / `yes` turn them on.

## Grant Plus without payments (ops)

Checkout stays `501` while `PAYMENTS_ENABLED` is off, so a Plus org is granted with SQL. Do **not** encode league names in application code. Confirm the rows first, then update those billing subscriptions:

```sql
SELECT l.id, l.name FROM leagues l WHERE l.name = 'Gazpachangas';

UPDATE subscriptions s
SET plan_id = (SELECT id FROM plans WHERE code = 'plus'), status = 'active'
FROM billing_accounts ba
JOIN leagues l ON ba.subject_type = 'league' AND ba.subject_id = l.id
WHERE s.billing_account_id = ba.id
  AND l.name = 'Gazpachangas';
```

Plus hubs hide `hub.sidebar` ads (`org.ad_free`). Overview and Billing ads are unchanged. Re-run the update (or target `l.id`) if you create another test league later.

## Schema updates

`npm start` does not migrate. Apply new SQL from `migrations/` in order.

If this server’s Drizzle journal is incomplete (typical after a 1.0 → 2.0 copy), **do not** run `npm run db:migrate` — it will try to replay `0000`. Apply the missing files with `psql -f`, the same way 0010–0013 were applied:

```bash
psql "$DATABASE_URL" -f migrations/0014_membership_join_open.sql
psql "$DATABASE_URL" -f migrations/0015_auth_email_identities.sql
psql "$DATABASE_URL" -f migrations/0016_billing_accounts.sql
psql "$DATABASE_URL" -f migrations/0017_password_reset_tokens.sql
psql "$DATABASE_URL" -f migrations/0018_match_join_open.sql
psql "$DATABASE_URL" -f migrations/0019_match_friendly.sql
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
