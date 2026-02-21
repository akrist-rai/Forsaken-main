// src/middleware/13.staticFiles.ts
// ─────────────────────────────────────────────────────────────
// LAYER 13 — Static Files  (serve /docs directory)
//
// koa-static serves every file inside the `docs/` directory
// under the URL prefix /docs/...
//
// Served files include:
//   docs/index.html            → /docs/index.html
//   docs/assets/logo.svg       → /docs/assets/logo.svg
//   docs/favicon.ico           → /docs/favicon.ico
//
// Security notes:
//   • hidden: false  – never serve dot-files (.env, .htaccess)
//   • maxAge 1 day in prod (browser cache), 0 in dev
//   • gzip / brotli handled upstream by the compress layer
//
// This middleware short-circuits (does not call next) when a
// matching file is found, so it MUST be placed before the router.
// ─────────────────────────────────────────────────────────────

import serve from "koa-static";
import path   from "node:path";
import type Koa from "koa";
import { config } from "../config/index.ts";

export const staticFiles = (): Koa.Middleware => {
  const root = path.resolve(process.cwd(), config.static.root);

  return serve(root, {
    // Cache-Control max-age: 1 day in prod, no cache in dev
    maxAge: config.isProd ? 86_400 * 1000 : 0,

    // Add immutable directive for hashed assets in prod
    immutable: config.isProd,

    // Never expose hidden / dot-files
    hidden: false,

    // Serve index.html for directory requests
    index: "index.html",

    // Let compress layer handle encoding — don't serve .gz files directly
    gzip:   false,
    brotli: false,
  });
};
