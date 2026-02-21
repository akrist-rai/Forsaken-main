// src/middleware/auth.ts
// ─────────────────────────────────────────────────────────────
// Auth helpers — used INSIDE routes, not as global layers
//
//   authenticate()   – verifies JWT, attaches ctx.state.user
//   requireRole(...) – guards a route to specific roles
//   validate(schema) – Zod body/query validator
//   demoLogin        – issues a JWT for the demo accounts
// ─────────────────────────────────────────────────────────────

import jwt                from "jsonwebtoken";
import type Koa           from "koa";
import type { AppState, AuthUser, UserRole } from "../types/index.ts";
import { config }         from "../config/index.ts";
import { AppError }       from "./01.errorHandler.ts";
import { z }              from "zod";

// ── Token helpers ─────────────────────────────────────────────
export const signToken = (payload: Omit<AuthUser, "iat" | "exp">): string =>
  jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn } as jwt.SignOptions);

export const verifyToken = (token: string): AuthUser =>
  jwt.verify(token, config.jwt.secret) as AuthUser;

// ── authenticate() ────────────────────────────────────────────
export const authenticate = (): Koa.Middleware<AppState> =>
  async (ctx, next) => {
    const header = ctx.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new AppError(401, "Missing Authorization header", "UNAUTHORIZED");
    }
    try {
      ctx.state.user = verifyToken(header.slice(7));
    } catch {
      throw new AppError(401, "Invalid or expired token", "TOKEN_INVALID");
    }
    await next();
  };

// ── requireRole(...roles) ─────────────────────────────────────
export const requireRole = (...roles: UserRole[]): Koa.Middleware<AppState> =>
  async (ctx, next) => {
    const user = ctx.state.user;
    if (!user)                    throw new AppError(401, "Not authenticated", "UNAUTHORIZED");
    if (!roles.includes(user.role))
      throw new AppError(403, `Requires role: ${roles.join(" | ")}`, "FORBIDDEN");
    await next();
  };

// ── validate(schema, source) ─────────────────────────────────
export const validate = <T>(
  schema: z.ZodSchema<T>,
  source: "body" | "query" = "body"
): Koa.Middleware<AppState> =>
  async (ctx, next) => {
    const data   = source === "body" ? ctx.request.body : ctx.query;
    const result = schema.safeParse(data);
    if (!result.success) {
      const details = result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`);
      throw new AppError(400, details.join("; "), "VALIDATION_ERROR");
    }
    ctx.state.validated = result.data;
    await next();
  };

// ── Demo login handler ────────────────────────────────────────
const DEMO_USERS: Record<string, { password: string; role: UserRole; name: string; id: string }> = {
  "manager@fleetflow.com":    { password: "manager123",  role: "manager",    name: "Fleet Manager",    id: "usr-001" },
  "dispatcher@fleetflow.com": { password: "dispatch123", role: "dispatcher", name: "Sarah Dispatcher", id: "usr-002" },
  "safety@fleetflow.com":     { password: "safety123",   role: "safety",     name: "Safety Officer",   id: "usr-003" },
  "finance@fleetflow.com":    { password: "finance123",  role: "finance",    name: "Finance Analyst",  id: "usr-004" },
};

export const demoLogin = async (ctx: Koa.ParameterizedContext<AppState>) => {
  const { email, password } = ctx.request.body as { email?: string; password?: string };
  if (!email || !password)
    throw new AppError(400, "email and password are required", "VALIDATION_ERROR");

  const user = DEMO_USERS[email];
  if (!user || user.password !== password)
    throw new AppError(401, "Invalid credentials", "INVALID_CREDENTIALS");

  const token = signToken({ sub: user.id, email, role: user.role, name: user.name });

  // Also persist to session so cookie-based clients work
  (ctx.session as Record<string, unknown>).userId = user.id;
  (ctx.session as Record<string, unknown>).role   = user.role;

  ctx.body = {
    success: true,
    data: {
      token,
      user:      { id: user.id, email, role: user.role, name: user.name },
      expiresIn: config.jwt.expiresIn,
    },
  };
};
