# HyperX Terminal — Deployment Guide

> Infrastructure architecture, deployment procedures, and operational runbooks

---

## Contents

1. [Production Topology](#production-topology)
2. [Railway Deployment](#railway-deployment)
3. [Docker Compose (Local)](#docker-compose-local)
4. [Vercel Deployment (Frontend)](#vercel-deployment-frontend)
5. [Environment Configuration](#environment-configuration)
6. [CI/CD Pipeline](#cicd-pipeline)
7. [Monitoring & Health Checks](#monitoring--health-checks)
8. [Database Migrations](#database-migrations)
9. [Scaling Considerations](#scaling-considerations)
10. [Troubleshooting](#troubleshooting)

---

## Production Topology

```
┌────────────────────────────────────────────────────────────────────┐
│                        PRODUCTION TOPOLOGY                           │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────┐     ┌──────────────────────────┐      │
│  │      Vercel (CDN)       │     │      Railway (US West)    │      │
│  │                         │     │                          │      │
│  │  hyperx.app ───────────►│     │  ┌────────────────────┐  │      │
│  │  *.vercel.app           │     │  │  api (Fastify)     │  │      │
│  │                         │     │  │  Port: $PORT       │  │      │
│  │  Static SPA served      │     │  │  Health: /health   │  │      │
│  │  from edge network      │     │  └─────────┬──────────┘  │      │
│  └─────────────────────────┘     │            │             │      │
│              │                   │  ┌─────────▼──────────┐  │      │
│              │                   │  │  ws (WebSocket)    │  │      │
│              │  API: /api/*      │  │  Port: $PORT       │  │      │
│              ├───────────────────┤  │  Health: /health   │  │      │
│              │  WS: /ws/*        │  └─────────┬──────────┘  │      │
│              │                   │            │             │      │
│              │                   │  ┌─────────▼──────────┐  │      │
│              │                   │  │  PostgreSQL 15     │  │      │
│              │                   │  │  (Railway plugin)  │  │      │
│              │                   │  └────────────────────┘  │      │
│              │                   │                          │      │
│              │                   │  ┌────────────────────┐  │      │
│              │                   │  │  Redis 7           │  │      │
│              │                   │  │  (Railway plugin)  │  │      │
│              │                   │  └────────────────────┘  │      │
│              │                   └──────────────────────────┘      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Architecture Decisions

- **Frontend on Vercel**: Static SPA with CDN edge delivery — zero server-side rendering means Vercel's global CDN provides the fastest Time-to-First-Byte for users worldwide. No need to pay for SSR compute on Railway.
- **API + WS on Railway**: Persistent connections and compute-heavy workloads colocated with the database for minimal latency. Railway's plugin system handles PostgreSQL and Redis provisioning automatically.
- **Database colocation**: API and PostgreSQL are within the same Railway region (US West by default), keeping query latency under 1ms.

---

## Railway Deployment

### Prerequisites

```bash
# Install Railway CLI
brew install railway

# Login
railway login

# Verify
railway whoami
```

### Project Setup

```bash
# The project is already initialized. Verify:
railway status
# Output:
#   Project: hyperx-terminal
#   Environment: production
#   Service: api (or ws)
```

### Deploying API

```bash
railway up --service api --path-as-root apps/api
```

This command:
1. Packages the `apps/api/` directory as the service root
2. Reads `apps/api/railway.json` for build/deploy configuration
3. Builds the Docker image from `apps/api/Dockerfile`
4. Runs the release command: `npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma`
5. Starts the container with Railway's `$PORT` environment variable
6. Performs health checks at `GET /health` (300s timeout, ALWAYS restart)

### Deploying WebSocket

```bash
railway up --service ws --path-as-root apps/ws
```

Same flow as API, with `apps/ws/railway.json` providing the config.

### Service Configuration

**`apps/api/railway.json`**:
```json
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "healthcheckPath": "/health",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ALWAYS",
    "releaseCommand": "npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma"
  }
}
```

**`apps/ws/railway.json`**:
```json
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "healthcheckPath": "/health",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ALWAYS"
  }
}
```

### Required Environment Variables

Set these in the Railway dashboard for each service:

#### API Service
| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/hyperx` |
| `JWT_SECRET` | JWT signing key (≥32 chars) | Generated via `openssl rand -base64 32` |
| `PORT` | Railway assigns this automatically | Do not set manually |
| `NODE_ENV` | Runtime environment | `production` |
| `PARADEX_JWT_TOKEN` | Paradex read-only token | Your Paradex JWT |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL | From Upstash dashboard |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token | From Upstash dashboard |

#### WS Service
| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Railway assigns this automatically | Do not set manually |
| `JWT_SECRET` | Must match API's JWT_SECRET | Same value as API |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL | Same as API |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token | Same as API |
| `PARADEX_JWT_TOKEN` | Required for Paradex WS bridge | Your Paradex JWT |
| `PARADEX_WS_ENABLED` | Toggle Paradex WS bridge | `true` |

### Deploy Process

```bash
# Full deploy (in order — WS first so market data is ready when API starts)
railway up --service ws --path-as-root apps/ws
railway up --service api --path-as-root apps/api

# Deploy specific service
railway up --service api --path-as-root apps/api

# View logs
railway logs --service api
railway logs --service ws

# Rollback
railway down --service api
railway down --service ws
```

---

## Docker Compose (Local)

For local development with all dependencies:

```bash
# Start everything
docker compose up -d

# This starts:
#   postgres:15-alpine  →  Port 5432
#   redis:7-alpine      →  Port 6379
#   api (from Dockerfile)→  Port 3001
#   ws  (from Dockerfile)→  Port 3002
#   web (from Dockerfile)→  Port 3000

# View logs
docker compose logs -f api ws

# Stop
docker compose down

# Full reset (destroys volumes)
docker compose down -v
```

### Docker Compose Configuration

**File**: `docker-compose.yml`

- **postgres**: PostgreSQL 15 with healthcheck via `pg_isready`. Data persisted in `postgres_data` volume.
- **redis**: Redis 7 with AOF persistence. Data persisted in `redis_data` volume.
- **api**: Built from `apps/api/Dockerfile` with `context: .`. Depends on postgres + redis healthy. Port 3001.
- **ws**: Built from `apps/ws/Dockerfile`. Depends on redis healthy. Port 3002.
- **web**: Built from `apps/web/Dockerfile` with nginx. Depends on api + ws (no health gate). Port 3000:80.

**Network**: All services on `hyperx-network` bridge.

---

## Vercel Deployment (Frontend)

The frontend is deployed to Vercel independently. No server-side rendering — pure static export served from Vercel's CDN.

### Vercel Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Production API URL (e.g., `https://api.hyperx.app`) |
| `VITE_WS_URL` | Production WebSocket URL (e.g., `wss://ws.hyperx.app`) |
| `VITE_STARKNET_RPC_URL` | Starknet RPC endpoint |
| `VITE_STARKNET_NETWORK` | `mainnet` or `sepolia` |

### Build Configuration

The `vercel.json` at project root controls the build:

```json
{
  "buildCommand": "pnpm -C apps/web build",
  "outputDirectory": "apps/web/dist",
  "framework": "vite"
}
```

---

## Environment Configuration

### Variable Precedence

```
1. Railway dashboard variables (highest priority)
2. .env file at project root (development only)
3. .env.example (defaults)
```

### Full Variable Reference

See `.env.example` for the complete list of 83 environment variables with documentation.

### Critical Variables

| Variable | Required | Service | Notes |
|----------|----------|---------|-------|
| `DATABASE_URL` | Yes | API | Must include `?schema=public` |
| `JWT_SECRET` | Yes | API + WS | Must be identical across both services |
| `PARADEX_JWT_TOKEN` | Yes* | API + WS | *Required for authenticated trading operations |
| `UPSTASH_REDIS_REST_URL` | Yes* | API + WS | *Optional — without it, rate limiting falls back to in-memory |
| `UPSTASH_REDIS_REST_TOKEN` | Yes* | API + WS | *Required if Redis URL is set |
| `VITE_API_URL` | Yes | Web | Must match the Railway API service domain |
| `VITE_WS_URL` | Yes | Web | Must match the Railway WS service domain |

---

## CI/CD Pipeline

**File**: `.github/workflows/ci.yml`

### Jobs

```
┌────────┐    ┌──────────┐    ┌──────────┐    ┌──────────────┐    ┌──────────┐
│  lint  │    │ test-web │    │ test-api │    │    build     │    │ security │
├────────┤    ├──────────┤    ├──────────┤    ├──────────────┤    ├──────────┤
│ ESLint │    │ Vitest   │    │ Vitest   │    │ pnpm build:  │    │ pnpm     │
│ tsc    │    │ jsdom    │    │ pg 15    │    │  web + api   │    │ audit    │
│        │    │ coverage │    │ migrate  │    │  + ws        │    │ (soft)   │
└────────┘    └──────────┘    └──────────┘    └──────────────┘    └──────────┘
```

- **lint**: TypeScript type-check + ESLint across all packages
- **test-web**: Unit and integration tests for the frontend (Vitest, jsdom)
- **test-api**: API tests with a real PostgreSQL 15 service container
- **build**: Compile all three apps to verify no build regressions
- **security**: `pnpm audit --production` (non-blocking, informational)

---

## Monitoring & Health Checks

### Health Endpoints

| Service | Endpoint | Response |
|---------|----------|----------|
| API | `GET /health` | `{ "ok": true, "db": true }` |
| WS | `GET /health` | `{ "ok": true, "clients": 42, "subscriptions": 156 }` |

### Railway Health Checks

- **API**: Health check at `/health`, 300s timeout before marking unhealthy, ALWAYS restart policy.
- **WS**: Health check at `/health`, 300s timeout before marking unhealthy, ALWAYS restart policy.
- **Database**: Railway PostgreSQL plugin provides its own health monitoring.

### Logging

```bash
# Railway logs
railway logs --service api -f     # Follow API logs
railway logs --service ws -f       # Follow WS logs

# Docker logs
docker compose logs -f api ws

# Access logs
docker compose logs api | jq '.level'  # Filter by log level
```

---

## Database Migrations

### Migration Strategy

Migrations are applied via Railway's `releaseCommand`:

```json
{
  "deploy": {
    "releaseCommand": "npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma"
  }
}
```

This runs **before** the container starts accepting traffic. If migrations fail, Railway marks the deploy as failed and keeps the previous version running.

### Manual Migrations

```bash
# Development
pnpm prisma:migrate

# Production (via Railway)
railway run --service api "npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma"

# Create new migration
pnpm prisma:migrate --name describe_change
```

### Migration History

Current migrations in `apps/api/prisma/migrations/`:
- `20260307204726_project_setup` — Initial schema (User, UserPreferences, ApiKey, PriceAlert, TradeRecord, AuditLog, Notification)
- `20260523120000_auth_sessions` — Added `tokenVersion` to User, created `AuthNonce` table

---

## Scaling Considerations

### When to Scale

| Signal | Action |
|--------|--------|
| API p99 latency > 200ms | Increase API memory/CPU in Railway dashboard |
| WS client count > 10,000 | Add WS instance, Redis pub/sub handles broadcasting |
| PostgreSQL CPU > 80% | Upgrade Railway PostgreSQL plan or add read replica |
| Redis memory > 70% | Upgrade Railway Redis plan |

### Horizontal Scaling

Both API and WS services are horizontally scalable:

- **API**: Stateless. All session state is in JWT tokens. All data is in PostgreSQL. Add more instances behind Railway's load balancer.
- **WS**: Stateful per-instance (client connections). Redis pub/sub ensures all instances receive all messages when users reconnect to different instances. Add more instances for higher connection capacity.

### Rate Limiting

When Redis is available, rate limiting uses a token bucket algorithm:

```typescript
const rateLimit = {
  maxPerMinute: 120,     // Default: 120 requests per minute
  redis: {
    key: `ratelimit:${ip}`,
    ttl: 60,             // 60-second sliding window
  },
  fallback: {
    maxPerMinute: 60,     // In-memory fallback is more conservative
  },
};
```

---

## Troubleshooting

### Deploy Failures

**Symptom**: `railway up` fails with "No Dockerfile found"

**Fix**: Ensure you're using `--path-as-root` flag:
```bash
railway up --service api --path-as-root apps/api
```

**Symptom**: Container starts but health checks fail

**Check**:
1. Verify database reachability: `DATABASE_URL` must be correct
2. Check logs: `railway logs --service api`
3. Test health endpoint: `curl https://api.railway.app/health`

### Migration Failures

**Symptom**: Release command fails with `prisma: not found`

**Check**: Prisma must be in `dependencies` (not `devDependencies`) in `apps/api/package.json`:
```json
{
  "dependencies": {
    "prisma": "^6.19.0",
    "@prisma/client": "^6.19.0"
  }
}
```

**Symptom**: Migration fails with "relation already exists"

**Fix**: The database may already have the schema. Run:
```bash
railway run --service api "npx prisma migrate resolve --schema=apps/api/prisma/schema.prisma --applied <migration-name>"
```

### WebSocket Issues

**Symptom**: Clients can't connect to WS

**Check**:
1. `JWT_SECRET` must be identical between API and WS services
2. WS health endpoint should return 200
3. Paradex WS bridge requires `PARADEX_JWT_TOKEN` to be set

### Performance Issues

**Symptom**: High latency on orderbook updates

**Check**:
1. Redis latency: `railway logs --service ws | grep "pubsub"`
2. Client count: `curl https://ws.railway.app/health`
3. Connection pool: Prisma datasource URL should use `pgbouncer` for connection pooling in production:
   ```
   DATABASE_URL=postgresql://user:pass@host:6543/hyperx?schema=public&pgbouncer=true&connection_limit=5
   ```

---

## Runbook: Complete Deploy

### First-Time Deploy

```bash
# 1. Login
railway login

# 2. Verify project exists
railway status

# 3. Deploy WS (market data provider, starts first)
railway up --service ws --path-as-root apps/ws

# 4. Verify WS health
curl https://ws.hyperx.app/health
# Expected: {"ok":true,"clients":0,"subscriptions":0}

# 5. Deploy API (depends on WS + DB)
railway up --service api --path-as-root apps/api

# 6. Verify API health
curl https://api.hyperx.app/health
# Expected: {"ok":true,"db":true}
```

### Routine Deploy

```bash
railway up --service ws --path-as-root apps/ws --detach
railway up --service api --path-as-root apps/api --detach
```

The `--detach` flag streams build+deploy logs to the terminal but doesn't attach to runtime logs.

### Rollback

```bash
# Rollback API to previous deployment
railway down --service api   # Takes down current
railway up --service api --path-as-root apps/api  # Redeploys latest build

# Or use Railway dashboard to promote a specific deployment
```

---

*For architecture details, see [ARCHITECTURE.md](../ARCHITECTURE.md). For security specifics, see [SECURITY.md](./SECURITY.md).*
