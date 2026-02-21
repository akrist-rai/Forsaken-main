// src/middleware/09.jsonPretty.ts
// ─────────────────────────────────────────────────────────────
// LAYER 9 — JSON Pretty-Print
//
// koa-json serialises ctx.body to formatted JSON when the request
// comes from a browser / curl (?pretty=1) and minified JSON in
// production by default.
//
// Rules:
//   • Development  → always pretty (2-space indent)
//   • Production   → minified unless ?pretty=1 is in the query
//   • Only applied when ctx.body is a plain object / array
// ─────────────────────────────────────────────────────────────

import json  from "koa-json";
import { config } from "../config/index.ts";

export const jsonPretty = () =>
  json({
    // In dev always pretty; in prod only when ?pretty=1
    pretty: config.isDev,

    // Honour ?pretty=1 query param in all environments
    param: "pretty",

    // Spaces per indent level
    spaces: 2,
  });
