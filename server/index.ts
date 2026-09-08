import { env } from "./env";
import { createApp } from "./app";
import { createServer } from "http";
import { setupVite, serveStatic, log } from "./vite";
import { closeDatabase } from "./db";

const app = createApp();

(async () => {
  const server = createServer(app);

  if (env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const shutdown = async () => {
    await closeDatabase();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  server.listen(
    {
      port: env.PORT,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${env.PORT}`);
    },
  );
})();
