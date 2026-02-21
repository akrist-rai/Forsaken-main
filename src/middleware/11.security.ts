// src/middleware/11.security.ts
// ─────────────────────────────────────────────────────────────
// LAYER 11 — Security Middleware
//
// A single composed middleware that enforces multiple low-level
// security rules before the request reaches any business logic:
//
//  a) IP blocklist          – hard-blocks known bad actors
//  b) Request size guard    – rejects oversized Content-Length
//  c) Method allowlist      – rejects uncommon HTTP verbs
//  d) Path sanitation       – blocks obvious traversal attempts
//  e) Response fingerprint  – removes Server / X-Powered-By
// ─────────────────────────────────────────────────────────────

import type Koa from "koa";
import type { AppState } from "../types/index.ts";
import { config } from "../config/index.ts";
import { logger } from "../config/logger.ts";
import { AppError } from "./01.errorHandler.ts";

const ALLOWED_METHODS = new Set([
  "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS",
]);

export const securityMiddleware = (): Koa.Middleware<AppState> => {
  const blockedIps = new Set(config.security.blockedIps);

  return async (ctx, next) => {
    // ── a) Remove fingerprinting headers ───────────────────────
    ctx.remove("X-Powered-By");
    ctx.set("X-Content-Type-Options", "nosniff");

    // ── b) IP blocklist ────────────────────────────────────────
    const clientIp = ctx.ip;
    if (blockedIps.has(clientIp)) {
      logger.warn("Blocked IP attempt", {
        ip:        clientIp,
        path:      ctx.path,
        requestId: ctx.state.requestId,
      });
      throw new AppError(403, "Access denied", "IP_BLOCKED");
    }

    // ── c) HTTP method allowlist ───────────────────────────────
    if (!ALLOWED_METHODS.has(ctx.method)) {
      throw new AppError(405, `Method ${ctx.method} not allowed`, "METHOD_NOT_ALLOWED");
    }

    // ── d) Content-Length guard ────────────────────────────────
    const contentLength = parseInt(ctx.headers["content-length"] ?? "0");
    if (contentLength > config.security.maxBodyBytes) {
      throw new AppError(
        413,
        `Request body too large (max ${config.security.maxBodyBytes} bytes)`,
        "PAYLOAD_TOO_LARGE"
      );
    }

    // ── e) Path traversal guard ────────────────────────────────
    if (ctx.path.includes("..") || ctx.path.includes("//")) {
      throw new AppError(400, "Invalid request path", "INVALID_PATH");
    }

    await next();
  };
};
