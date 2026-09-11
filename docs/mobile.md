# Mobile packaging

Pachanga has **one** UI: the React + Vite app in `client/`. Do not add a second frontend (React Native, Expo, Flutter, or a `mobile/` package). A later store build wraps this same SPA.

## Web contract (already in 2.1)

- `VITE_API_BASE_URL` — empty for same-origin web. For a native WebView, set it at **Vite build time** to the public API origin (`PUBLIC_URL`).
- Server `CORS_ORIGINS` — comma-separated extra origins. When set, Capacitor defaults (`https://localhost`, `capacitor://localhost`, `http://localhost`) are also allowed on `/api/*`.
- Auth stays JWT in `localStorage`.
- `client/index.html` is installable (`viewport-fit=cover`, theme color, web app manifest). There is no service worker yet.

## Later wrap (not this milestone)

Use Capacitor (or an equivalent WebView) against Vite’s output:

```text
webDir: dist/public
```

Example `capacitor.config.ts` (do not add `@capacitor/*` to the Node boot path until you are actually wrapping):

```ts
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.pachanga.fantasy",
  appName: "Pachanga",
  webDir: "dist/public",
};

export default config;
```

Build the client with the API origin baked in:

```bash
VITE_API_BASE_URL=https://your-public-host npm run build
npx cap add android
npx cap add ios
```

Do not commit generated `android/` or `ios/` trees until a dedicated native milestone. No push notifications, deep links, or store in-app purchases in 2.1.
