// src/config/index.ts
// ─────────────────────────────────────────────────────────────
// Single source of truth for every runtime config value.
// Import this instead of reading process.env directly.
// ─────────────────────────────────────────────────────────────

const required = (key: string): string => {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
};

const optional = (key: string, fallback: string): string =>
  process.env[key] ?? fallback;

export const config = {
  // ── Server ─────────────────────────────────────────────────
  port:     parseInt(optional("PORT", "3001")),
  env:      optional("NODE_ENV", "development"),
  isDev:    optional("NODE_ENV", "development") === "development",
  isProd:   optional("NODE_ENV", "development") === "production",

  // ── Supabase ───────────────────────────────────────────────
  supabase: {
    url:        optional("SUPABASE_URL", "https://example.supabase.co"),
    anonKey:    optional("SUPABASE_ANON_KEY", "dev-anon-key"),
    serviceKey: optional("SUPABASE_SERVICE_KEY", "dev-service-key"),
    dbUrl:      optional("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/fleetflow"),
  },

  // ── JWT ────────────────────────────────────────────────────
  jwt: {
    secret:    optional("JWT_SECRET", "dev-secret-CHANGE-IN-PROD"),
    expiresIn: optional("JWT_EXPIRES_IN", "8h"),
  },

  // ── Redis ──────────────────────────────────────────────────
  redis: {
    url:         optional("REDIS_URL", "redis://localhost:6379"),
    sessionDb:   parseInt(optional("REDIS_SESSION_DB",   "0")),
    ratelimitDb: parseInt(optional("REDIS_RATELIMIT_DB", "1")),
  },

  // ── Session ────────────────────────────────────────────────
  session: {
    // MUST be 32 bytes for AES-256-CBC used by koa-session
    key:    optional("SESSION_KEY", "fleetflow-sess-key-32-bytes!!!!!"),
    maxAge: parseInt(optional("SESSION_MAX_AGE_MS", String(8 * 60 * 60 * 1000))), // 8 h
    prefix: "ff:sess:",
  },

  // ── Rate limit ─────────────────────────────────────────────
  rateLimit: {
    windowMs: parseInt(optional("RATE_WINDOW_MS", "60000")), // 1 min
    max:      parseInt(optional("RATE_MAX",        "120")),  // req / window
    prefix:   "ff:rl:",
  },

  // ── CORS ───────────────────────────────────────────────────
  cors: {
    origins: optional("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000")
      .split(",")
      .map((o) => o.trim()),
  },

  // ── Static files ───────────────────────────────────────────
  static: {
    root:   optional("STATIC_ROOT", "docs"),
    prefix: optional("STATIC_PREFIX", "/docs"),
  },

  // ── Logging ────────────────────────────────────────────────
  log: {
    level: optional("LOG_LEVEL", "info"),
    dir:   optional("LOG_DIR",   "logs"),
  },

  // ── Security ───────────────────────────────────────────────
  security: {
    // Comma-separated list of blocked IPs
    blockedIps:    optional("BLOCKED_IPS",      "").split(",").filter(Boolean),
    maxBodyBytes:  parseInt(optional("MAX_BODY_BYTES", String(5 * 1024 * 1024))),  // 5 MB
  },
} as const;
