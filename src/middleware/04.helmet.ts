// src/middleware/04.helmet.ts
// ─────────────────────────────────────────────────────────────
// LAYER 4 — Helmet  (security HTTP headers)
//
// koa-helmet wraps the battle-tested `helmet` package for Koa.
// Each header set is explained inline.
//
// Headers applied:
//   X-DNS-Prefetch-Control       – prevents DNS pre-fetching
//   X-Frame-Options              – blocks clickjacking (DENY)
//   X-Download-Options           – IE download behaviour
//   X-Content-Type-Options       – no MIME sniffing
//   X-XSS-Protection             – legacy XSS filter
//   Referrer-Policy              – strict-origin-when-cross-origin
//   Strict-Transport-Security    – HTTPS only (production)
//   Permissions-Policy           – disable unused browser features
// ─────────────────────────────────────────────────────────────

import helmet from "koa-helmet";
import { config } from "../config/index.ts";

export const helmetMiddleware = () =>
  helmet({
    // ── Block iframe embedding (clickjacking protection) ─────
    frameguard: { action: "deny" },

    // ── Disable MIME type sniffing ───────────────────────────
    noSniff: true,

    // ── HTTPS enforcement — only in production ───────────────
    hsts: config.isProd
      ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
      : false,

    // ── No inline scripts / eval via CSP ────────────────────
    // Disabled for pure API (no HTML served) — enable if you
    // ever serve an admin HTML page.
    contentSecurityPolicy: false,

    // ── Referrer policy ─────────────────────────────────────
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },

    // ── DNS prefetch control ─────────────────────────────────
    dnsPrefetchControl: { allow: false },

    // ── Cross-Origin-Opener-Policy ───────────────────────────
    crossOriginOpenerPolicy: { policy: "same-origin" },
  });
