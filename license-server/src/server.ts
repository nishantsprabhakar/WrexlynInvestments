/**
 * Wrexlyn for Investments license-server — Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
 * See LICENSE for details.
 *
 * Express app wiring. Run with `npm run dev` locally or `npm start` after
 * `npm run build`; see .env.example / README.md for required environment
 * variables.
 */
import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { createPgDb, initSchema, type Db } from "./db";
import { createApiRouter } from "./routes/api";
import { createAdminRouter } from "./routes/admin";

export function buildApp(db: Db, adminPassword: string) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());

  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
    if (process.env.NODE_ENV === "production") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    if (_req.path.startsWith("/admin")) res.setHeader("Cache-Control", "no-store");
    next();
  });

  app.use("/api", createApiRouter(db));
  app.use("/admin", createAdminRouter(db, adminPassword));
  app.get("/", (_req, res) => res.redirect("/admin"));

  return app;
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const port = Number(process.env.PORT) || 8788;

  if (!connectionString) {
    console.error("DATABASE_URL is required — see .env.example.");
    process.exit(1);
  }
  if (!adminPassword) {
    console.error("ADMIN_PASSWORD is required — see .env.example.");
    process.exit(1);
  }

  const db = createPgDb(connectionString);
  await initSchema(db);

  const app = buildApp(db, adminPassword);
  app.listen(port, () => {
    console.log(`Wrexlyn for Investments license-server listening on http://localhost:${port} (admin dashboard at /admin)`);
  });
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Fatal startup error:", err);
    process.exit(1);
  });
}
