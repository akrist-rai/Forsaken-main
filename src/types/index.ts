// src/types/index.ts
// ─────────────────────────────────────────────────────────────
// Shared type declarations for FleetFlow
// Extends Koa's DefaultState / DefaultContext so every
// middleware has full type safety on ctx.state
// ─────────────────────────────────────────────────────────────

import type { ParameterizedContext, DefaultContext } from "koa";

// ── User roles ────────────────────────────────────────────────
export type UserRole = "manager" | "dispatcher" | "safety" | "finance";

export interface AuthUser {
  sub:   string;
  email: string;
  role:  UserRole;
  name:  string;
  iat?:  number;
  exp?:  number;
}

// ── Extended Koa state (attached by middleware) ───────────────
export interface AppState {
  requestId: string;          // set by requestId middleware
  startTime: number;          // set by responseTime middleware
  user?:     AuthUser;        // set by authenticate middleware
  validated?: unknown;        // set by validate() helper
}

// ── Extended Koa context ──────────────────────────────────────
export type AppContext = ParameterizedContext<AppState, DefaultContext>;

// ── Structured error shape returned to clients ────────────────
export interface ApiError {
  success: false;
  error: {
    code:      string;
    message:   string;
    requestId?: string;
    stack?:    string;         // only in development
  };
}

// ── Structured success shape ──────────────────────────────────
export interface ApiSuccess<T = unknown> {
  success: true;
  data:    T;
  count?:  number;
  meta?:   Record<string, unknown>;
}
