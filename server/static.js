import { fileURLToPath } from "url";
import path from "path";
import express from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.join(__dirname, "../client/dist");

export function serveStatic(app) {
  // Assets with content hashes (e.g. /assets/StepBasicInfo-abc123.js) can be cached
  // long-term since the filename changes whenever the content changes.
  app.use(
    "/assets",
    express.static(path.join(clientDist, "assets"), {
      maxAge: "1y",
      immutable: true,
    })
  );

  // Other static files (favicon, manifest, etc.) — short cache
  app.use(express.static(clientDist, { maxAge: "1h" }));

  // SPA fallback — serve index.html for all non-API routes.
  // CRITICAL: index.html MUST be served with no-cache headers so that browsers
  // always fetch the latest version. Stale cached index.html references old chunk
  // hashes that no longer exist after a new deployment, causing the MIME type error:
  //   "Expected a JavaScript module but server responded with text/html"
  app.get("/{*splat}", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.sendFile(path.join(clientDist, "index.html"));
  });
}
