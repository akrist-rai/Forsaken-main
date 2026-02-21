// src/middleware/08.bodyParser.ts
// ─────────────────────────────────────────────────────────────
// LAYER 8 — Body Parser  (JSON + URL-encoded form data)
//
// koa-bodyparser handles two content types in one pass:
//
//   application/json                 → ctx.request.body (object)
//   application/x-www-form-urlencoded→ ctx.request.body (object)
//
// Multipart/form-data (file uploads) is NOT parsed here;
// use a dedicated upload middleware (e.g. @koa/multer) for that.
//
// onerror throws a 400 so the error-handler (layer 1) formats it.
// ─────────────────────────────────────────────────────────────

import bodyParser from "koa-bodyparser";
import { config }  from "../config/index.ts";

export const bodyParserMiddleware = () =>
  bodyParser({
    // Enable both JSON and URL-encoded form parsing
    enableTypes: ["json", "form"],

    // Maximum allowed body size
    jsonLimit: `${config.security.maxBodyBytes}b`,
    formLimit: `${config.security.maxBodyBytes}b`,

    // Throw a 400 on malformed bodies (error-handler will format it)
    onerror(err, ctx) {
      ctx.throw(400, `Body parse error: ${err.message}`);
    },

    // Detect content-type strictly (don't guess)
    detectJSON: undefined,

    // Only parse bodies that have a Content-Type header
    extendTypes: {
      json: ["application/json", "application/cjson"],
    },
  });
