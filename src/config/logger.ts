// src/config/logger.ts
// ─────────────────────────────────────────────────────────────
// Winston structured logger
// – console (colorised) in development
// – JSON file rotation in production
// ─────────────────────────────────────────────────────────────

import { createLogger, format, transports } from "winston";
import { config } from "./index.ts";

const { combine, timestamp, colorize, printf, json, errors } = format;

// ── Pretty format for the console (dev) ──────────────────────
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: "HH:mm:ss" }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, requestId, ...meta }) => {
    const rid = requestId ? ` [${requestId}]` : "";
    const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return `${ts}${rid} ${level}: ${message}${extra}`;
  })
);

// ── JSON format for file sinks (prod) ────────────────────────
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

export const logger = createLogger({
  level: config.log.level,
  transports: [
    // Always log to console
    new transports.Console({
      format: config.isDev ? devFormat : prodFormat,
    }),
    // In production also write to rotating files
    ...(config.isProd
      ? [
          new transports.File({
            filename: `${config.log.dir}/error.log`,
            level: "error",
            format: prodFormat,
          }),
          new transports.File({
            filename: `${config.log.dir}/combined.log`,
            format: prodFormat,
          }),
        ]
      : []),
  ],
});
