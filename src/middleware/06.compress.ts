// src/middleware/06.compress.ts
// ─────────────────────────────────────────────────────────────
// LAYER 6 — Gzip / Brotli Compression
//
// koa-compress negotiates the best available encoding with the
// client via the Accept-Encoding header:
//   brotli  (br)  — best ratio, all modern browsers
//   gzip          — universal fallback
//   deflate       — last resort
//
// Only responses above `threshold` bytes are compressed to avoid
// overhead on tiny payloads.
// ─────────────────────────────────────────────────────────────

import compress from "koa-compress";
import { constants } from "node:zlib";

export const compressMiddleware = () =>
  compress({
    // Minimum response size to compress (bytes)
    threshold: 1024,

    // Gzip options
    gzip: {
      flush: constants.Z_SYNC_FLUSH,
    },

    // Brotli options (preferred when client supports it)
    br: {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: 4, // 0-11; 4 = good speed/ratio balance
      },
    },

    // Only compress compressible MIME types
    filter: (mimeType: string) =>
      /\btext\b|\bjson\b|\bjavascript\b|\bxml\b|\bsvg\b/.test(mimeType),
  });
