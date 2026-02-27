import { fileURLToPath } from "url";
import path from "path";
import express from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.join(__dirname, "../client/dist");

export function serveStatic(app) {
  app.use(express.static(clientDist));
  // SPA fallback — serve index.html for non-API routes
  app.get("/{*splat}", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(clientDist, "index.html"));
  });
}
