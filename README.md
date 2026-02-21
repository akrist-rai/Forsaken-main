# FleetFlow Backend

Koa + Bun TypeScript backend with authentication, middleware stack, and demo fleet routes.

## Project Structure

- `src/server.ts`: application entrypoint
- `src/config/*`: environment config, logger, Redis clients
- `src/middleware/*`: 13-layer middleware onion and auth helpers
- `src/router/*`: API routes (`vehicles`, `drivers`, `trips`)
- `src/types/index.ts`: shared TypeScript types
- `db/schema.ts`: Drizzle schema definitions
- `db/config.ts`: DB config for Drizzle
- `db/migrations/`: generated SQL migrations
- `docs/`: static frontend files (GitHub Pages compatible)

## Prerequisites

- Bun 1.1+
- Redis (local or remote)
- Node.js 20+ (for tooling/type checks)

## Setup

1. Install dependencies:

```bash
bun install
```

2. Create environment file:

```bash
cp .env.example .env
```

3. Fill required secrets in `.env`:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- `DATABASE_URL`
- `JWT_SECRET`
- `SESSION_KEY`

4. Start Redis (if local):

```bash
redis-server
```

5. Apply database schema:

```bash
bun run db:push
```

## Run

Development mode (hot reload):

```bash
bun run dev
```

Production-like start:

```bash
bun run start
```

Server default URL:

- `http://localhost:3001`
- Health check: `GET /health`
- Frontend dashboard: `http://localhost:3001/`

## Quality Checks

Type check:

```bash
bun run lint
```

Drizzle database commands:

```bash
bun run db:generate
bun run db:push
bun run db:studio
```

## Demo Auth

Login endpoint:

- `POST /api/auth/login`

Demo users:

- `manager@fleetflow.com` / `manager123`
- `dispatcher@fleetflow.com` / `dispatch123`
- `safety@fleetflow.com` / `safety123`
- `finance@fleetflow.com` / `finance123`

Example login request:

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"manager@fleetflow.com","password":"manager123"}'
```

Use returned bearer token for protected routes:

```bash
curl http://localhost:3001/api/vehicles \
  -H "Authorization: Bearer <TOKEN>"
```

## Frontend

The frontend is a static dashboard served by Koa from `docs/`.

Features:
- Login screen for demo users
- KPI cards for fleet metrics
- Vehicles, drivers, and trips tables
- Create vehicle and create trip actions
- Trip dispatch/complete/cancel actions

Run and open:

1. Start server:
```bash
bun run dev
```
2. Open in browser:
- `http://localhost:3001/`

For GitHub Pages deployment, publish the `docs/` folder.  
If API is hosted elsewhere, set a global base URL before loading `app.js`:

```html
<script>window.FLEETFLOW_API_BASE = "https://your-api-host.com";</script>
```

## Business Logic Endpoints

- `GET /api/dispatch/available`
- `GET /api/analytics/dashboard`
- `GET /api/analytics/finance`
- `GET /api/expenses`
- `POST /api/trips/:id/fuel-log`

## Notes

- Business data is now persisted in Postgres via Drizzle (no in-memory router state).
- App startup seeds baseline demo vehicle/driver/trip records when DB is empty.
- Redis connection failures are handled gracefully at startup, but sessions/rate-limits degrade without Redis.
