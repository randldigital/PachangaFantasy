import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { registerRoutes } from "./routes";
import { AppError, toErrorBody } from "./errors";
import { logger } from "./logger";
import { corsMiddleware } from "./cors";

export function createApp(): Express {
  const app = express();
  app.use(corsMiddleware);
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, unknown> | undefined;

    const originalResJson = res.json.bind(res);
    res.json = ((bodyJson: any) => {
      capturedJsonResponse = bodyJson;
      return originalResJson(bodyJson);
    }) as Response["json"];

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }
        if (logLine.length > 80) {
          logLine = logLine.slice(0, 79) + "…";
        }
        logger.info(logLine);
      }
    });

    next();
  });

  registerRoutes(app);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      if (!res.headersSent) {
        res.status(err.status).json(toErrorBody(err));
      }
      return;
    }

    const status =
      typeof err === "object" && err !== null && "status" in err
        ? Number((err as { status?: number }).status) || 500
        : 500;
    const message =
      err instanceof Error ? err.message : "Internal Server Error";

    logger.error("Unhandled error", err);
    if (!res.headersSent) {
      res.status(status).json({ message, code: "INTERNAL_ERROR" });
    }
  });

  return app;
}
