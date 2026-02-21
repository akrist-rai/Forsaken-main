// src/middleware/index.ts
// ═══════════════════════════════════════════════════════════════
// KOA ONION MIDDLEWARE — COMPLETE STACK (13 layers)
//
// applyMiddleware() registers every layer in the correct order.
// Each layer file is independently importable for unit testing.
//
// Onion execution (→ = request, ← = response):
//
//  01 errorHandler    → wraps everything, formats JSON errors   ←
//  02 requestId       → attaches X-Request-ID header           ←
//  03 responseTime    → measures and sets X-Response-Time      ←
//  04 helmet          → security HTTP headers                  ←
//  05 httpLogger      → koa-logger lines via Winston           ←
//  06 compress        → gzip / brotli encoding                 ←
//  07 cors            → CORS preflight + headers               ←
//  08 bodyParser      → JSON + URL-encoded form parsing        ←
//  09 jsonPretty      → formatted JSON output                  ←
//  10 session         → Redis-backed session + cookie parsing  ←
//  11 security        → IP block, method check, size guard     ←
//  12 rateLimit       → Redis sliding-window rate limiting     ←
//  13 staticFiles     → serve /docs directory                 ←
//      ROUTER         → business logic routes                 ←
// ═══════════════════════════════════════════════════════════════

import type Koa from "koa";

import { errorHandler }         from "./01.errorHandler.ts";
import { requestId }            from "./02.requestId.ts";
import { responseTime }         from "./03.responseTime.ts";
import { helmetMiddleware }     from "./04.helmet.ts";
import { httpLogger }           from "./05.httpLogger.ts";
import { compressMiddleware }   from "./06.compress.ts";
import { corsMiddleware }       from "./07.cors.ts";
import { bodyParserMiddleware } from "./08.bodyParser.ts";
import { jsonPretty }           from "./09.jsonPretty.ts";
import { sessionMiddleware }    from "./10.session.ts";
import { securityMiddleware }   from "./11.security.ts";
import { rateLimit }            from "./12.rateLimit.ts";
import { staticFiles }          from "./13.staticFiles.ts";

export function applyMiddleware(app: Koa): void {
  app.use(errorHandler());         // 01 — outermost: must be first
  app.use(requestId());            // 02
  app.use(responseTime());         // 03
  app.use(helmetMiddleware());     // 04
  app.use(httpLogger());           // 05
  app.use(compressMiddleware());   // 06
  app.use(corsMiddleware());       // 07
  app.use(bodyParserMiddleware()); // 08
  app.use(jsonPretty());           // 09
  app.use(sessionMiddleware(app)); // 10 — needs app ref for signing keys
  app.use(securityMiddleware());   // 11
  app.use(rateLimit());            // 12
  app.use(staticFiles());          // 13 — must be before router
  // Routes are mounted in server.ts
}

// Re-export route-level helpers (single import in routes)
export { authenticate, requireRole, validate, demoLogin } from "./auth.ts";
export { AppError }      from "./01.errorHandler.ts";
export { authRateLimit } from "./12.rateLimit.ts";
