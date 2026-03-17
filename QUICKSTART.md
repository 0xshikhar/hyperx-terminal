# HyperX Terminal — Quick Start Guide

> Get a full development environment running in under 5 minutes

---

## Prerequisites

- **Node.js** >= 22.0.0
- **pnpm** >= 10.0.0
- **PostgreSQL** >= 14 (local or Docker)
- **Redis** >= 7 (optional, for rate limiting and pub/sub)
- **Starknet wallet** (Argent X, Braavos, or Cartridge)

---

## Installation

```bash
# 1. Clone
git clone <repo-url>
cd hyperx-terminal

# 2. Install dependencies
pnpm install

# 3. Environment setup
cp .env.example .env
# Edit .env — at minimum set:
#   DATABASE_URL
#   JWT_SECRET (generate with: openssl rand -base64 32)

# 4. Database migrations
pnpm prisma:migrate

# 5. Start all services
pnpm dev
```

The development servers will be available at:

| Service | URL |
|---------|-----|
| Web app | http://localhost:3000 |
| API | http://localhost:3001 |
| WebSocket | ws://localhost:3002 |

---

## Docker Setup

For a full environment without installing PostgreSQL/Redis locally:

```bash
docker compose up -d
# Starts: postgres (5432), redis (6379), api (3001), ws (3002), web (3000)
```

Then start the dev servers with live reload:

```bash
pnpm dev:api   # Fastify with hot reload (tsx watch)
pnpm dev:ws    # WebSocket with hot reload (tsx watch)
pnpm dev:web   # Vite dev server with HMR
```

---

## Authentication

1. Open http://localhost:3000/login
2. Connect your Starknet wallet
3. Sign the SNIP-12 typed data message
4. Start trading

**No passwords. No private keys stored. Your wallet signature proves ownership.**

---

## Project Structure

```
apps/
  api/         REST API server (Fastify 5 + Prisma 6 + PostgreSQL)
  ws/          WebSocket server (ws + Redis pub/sub)
  web/         Frontend SPA (React 18 + Vite 7 + Tailwind 4)
packages/
  types/       Shared TypeScript types (DTOs, WS messages, DEX interfaces)
docs/
  DEPLOYMENT.md     Railway deployment and Docker orchestration
  SECURITY.md       Auth flow, threat model, key management
  PERFORMANCE.md    Rendering pipeline, virtualization, bundle optimization
```

---

## Common Commands

| Command | Action |
|---------|--------|
| `pnpm dev` | Start all services in parallel |
| `pnpm dev:web` | Start frontend only |
| `pnpm dev:api` | Start API only |
| `pnpm dev:ws` | Start WebSocket only |
| `pnpm build` | Build all services |
| `pnpm test` | Run all tests |
| `pnpm test:web` | Frontend tests (Vitest, jsdom) |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm prisma:migrate` | Apply database migrations |
| `pnpm prisma:studio` | Open Prisma Studio (data browser) |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Command Palette |
| `Ctrl+T` | Toggle theme |
| `?` | Keyboard shortcuts help |
| `G T` | Go to Terminal |
| `G M` | Go to Markets |
| `G P` | Go to Portfolio |
| `B` / `S` | Focus Buy / Sell |
| `M` / `L` | Market / Limit order |
| `Enter` | Submit order |

---

## Configuration

### Environment Variables

**Root `.env`** (API/WS config):
| Variable | Required | Default |
|----------|----------|---------|
| `DATABASE_URL` | Yes | — |
| `JWT_SECRET` | Yes | dev-jwt-secret-change-in-production |
| `UPSTASH_REDIS_REST_URL` | No | — |
| `PARADEX_JWT_TOKEN` | No | — |

**`apps/web/.env`** (Frontend config):
| Variable | Required | Default |
|----------|----------|---------|
| `VITE_API_URL` | Yes | http://localhost:3001 |
| `VITE_WS_URL` | Yes | ws://localhost:3002 |
| `VITE_STARKNET_RPC_URL` | No | Starknet mainnet public RPC |

### Database

```bash
# Create a new migration
pnpm prisma:migrate --name add_new_feature

# Reset database (destroys data)
pnpm prisma:migrate --name reset

# Open Prisma Studio
pnpm prisma:studio
```

---

## Troubleshooting

### "Cannot connect to wallet"
- Ensure wallet extension is installed and unlocked
- Verify you're on the correct Starknet network (mainnet/sepolia)
- Check browser console for specific error messages

### "Authentication failed"
- Verify `JWT_SECRET` is set in `.env`
- Clear cookies and localStorage, try again
- Nonces expire after 5 minutes — refresh the page and retry

### "WebSocket won't connect"
- Ensure `pnpm dev:ws` is running
- Verify `VITE_WS_URL` in `apps/web/.env` matches your WS server
- Check for CORS issues in browser console

### "Database errors"
- Ensure PostgreSQL is running: `pg_isready`
- Verify `DATABASE_URL` in `.env` is correct
- Run migrations: `pnpm prisma:migrate`

### "Build fails"
```bash
# Clean rebuild
rm -rf **/node_modules pnpm-lock.yaml
pnpm install
pnpm build
```

---

## Documentation

| Document | What It Covers |
|----------|----------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture, data flow, state management, technical decisions |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Railway deployment, Docker Compose, CI/CD, scaling |
| [docs/SECURITY.md](./docs/SECURITY.md) | Auth flow, threat model, rate limiting, key management |
| [docs/PERFORMANCE.md](./docs/PERFORMANCE.md) | Render pipeline, virtualization, bundle optimization |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Code style, test strategy, PR process |

---

## Support

- **Issues**: GitHub Issues
- **Discord**: [Join our server](https://discord.gg/hyperx)

---

*For the complete architecture story, see [ARCHITECTURE.md](./ARCHITECTURE.md).*
