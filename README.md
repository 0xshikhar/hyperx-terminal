# HyperX Terminal

<p align="center">
  <img src="./apps/web/public/hyperx.svg" alt="HyperX Terminal" width="140" />
</p>

<p align="center">
  <strong>High-Performance Perpetual Futures Trading Terminal for Starknet</strong>
  <br />
  <em>Real-time market data · Multi-DEX aggregation · Professional-grade charting · Sub-50ms data propagation</em>
</p>

<p align="center">
  <a href="#-architecture">Architecture</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-features">Features</a> •
  <a href="#-documentation">Docs</a> •
  <a href="#-keyboard-shortcuts">Shortcuts</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18.3-58c4dc?logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Fastify-5-000000?logo=fastify" alt="Fastify" />
  <img src="https://img.shields.io/badge/Starknet-6-1a1a2e?logo=ethereum" alt="Starknet" />
  <img src="https://img.shields.io/badge/Prisma-6-2d3748?logo=prisma" alt="Prisma" />
  <img src="https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Redis-7-dc382d?logo=redis" alt="Redis" />
  <img src="https://img.shields.io/badge/pnpm-10-f69220?logo=pnpm" alt="pnpm" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
</p>

---

## Overview

HyperX Terminal is a professional-grade cryptocurrency trading terminal purpose-built for the **Starknet ecosystem**. It provides real-time market data aggregation across multiple DEXs (Paradex, Extended Exchange), advanced orderbook visualization, algorithmic charting, position management, and performance analytics — all within a high-performance React interface engineered for sub-millisecond interaction latency.

Unlike general-purpose DeFi dashboards, HyperX was designed from the ground up for active perpetual futures traders who demand:

- **Sub-50ms WebSocket data propagation** — msgpack-binary encoded, RAF-throttled rendering pipeline
- **Multi-DEX aggregation** — transparent order routing across Paradex (testnet/mainnet) and Extended Exchange
- **Starknet-native authentication** — SNIP-12 typed-data signing with wallet-agnostic support (Argent X, Braavos, Cartridge, Starkzap)
- **Professional information density** — compact layout exposing 20+ data points per viewport without scrolling
- **WS1 to WS3 data granularity** — supports level-2 orderbook, trade-by-trade feeds, candle intervals from 1m to 1d

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            HYPERX TERMINAL                               │
├─────────────────────┬────────────────────────┬──────────────────────────┤
│                     │                        │                          │
│    apps/web         │     apps/api           │      apps/ws             │
│  React 18 + Vite 7  │   Fastify 5 + Prisma 6 │   ws + Redis Pub/Sub     │
│  lightweight-charts │   PostgreSQL · Upstash  │   Paradex WS Bridge      │
│  Zustand 5 Stores   │   Zod validation       │   JWT Auth               │
│  WSClient (msgpack) │   Rate limiting        │   Subscription Manager   │
│  shadcn/ui · TW 4   │   JWT auth middleware  │   Message Dispatcher     │
│                     │                        │                          │
├─────────────────────┴────────────────────────┴──────────────────────────┤
│                                                                          │
│                     packages/types  ← Shared TS types                    │
│    API DTOs · WebSocket message schemas · DEX interfaces · Market utils  │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Infrastructure                                                         │
│   pnpm workspaces · Docker Compose · Railway · GitHub Actions CI         │
│   Multi-stage Dockerfiles · Prisma migrations · Redis pub/sub scaling    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Starknet DEXs ────┬─── Paradex REST/WS ──► apps/api ──┬──► PostgreSQL
                  │                                    │
                  └─── Extended REST ────► apps/ws ────┤
                                                       │
                                          ┌────────────┘
                                          ▼
                                    Redis Pub/Sub
                                          │
                                          ▼
                                   WebSocket Server
                                          │
                              msgpack-encoded frames
                                          │
                                    apps/web (React)
                                   Zustand stores
                                   RAF-throttled render
```

### Repository Structure

```
├── apps/
│   ├── api/              REST API server (Fastify · Prisma · JWT auth)
│   │   ├── src/
│   │   │   ├── dex/          Paradex & Extended DEX clients
│   │   │   ├── middleware/   Auth, rate limiting
│   │   │   ├── routes/       Auth routes
│   │   │   └── services/     Auth, notifications
│   │   └── prisma/           Schema + migrations
│   │
│   ├── ws/               WebSocket server (ws · Redis pub/sub)
│   │   └── src/
│   │       ├── SubscriptionManager.ts   Client registry + channel routing
│   │       ├── MessageDispatcher.ts     Fan-out dispatch + Redis pub
│   │       ├── paradexWs.ts             Paradex WS bridge + reconnection
│   │       └── pubsub.ts                Upstash Redis polling subscriber
│   │
│   ├── web/              Frontend (React 18 · Vite 7 · Tailwind 4)
│   │   └── src/
│   │       ├── components/  80+ feature components across 15 domains
│   │       ├── hooks/       18 custom hooks (WS, throttling, state machine)
│   │       ├── services/    API client + WS client + auth
│   │       ├── store/       11 Zustand stores
│   │       └── pages/       Terminal · Markets · Portfolio · Login · Onboard
│   │
├── packages/
│   └── types/            Shared TypeScript package (5 modules)
│       └── src/
│           ├── api/          REST DTOs (436 lines)
│           ├── websocket/    WS message types (179 lines)
│           ├── dex/          DEX integration types (302 lines)
│           └── common/       Enums, market helpers, base types
│
├── docs/                 Architectural documentation
├── docker-compose.yml    Local full-stack orchestration
└── railway.json           Railway deployment config root
```

---

## Quick Start

```bash
# Prerequisites: Node.js >= 22, pnpm >= 10, PostgreSQL

# Clone & install
git clone <repo-url> && cd hyperx-terminal
pnpm install

# Environment
cp .env.example .env            # Edit DATABASE_URL, JWT_SECRET
cp apps/web/.env.example apps/web/.env  # Edit VITE_API_URL, VITE_WS_URL

# Database
pnpm prisma:migrate

# Start all services
pnpm dev
# → Web:   http://localhost:3000
# → API:   http://localhost:3001
# → WS:    ws://localhost:3002
```

For detailed setup steps, see **[QUICKSTART.md](./QUICKSTART.md)**.

---

## Features

### Market Data & Charting
| Feature | Implementation |
|---------|---------------|
| Real-time orderbook | WebSocket with msgpack encoding, virtualized 1000+ rows |
| Candlestick charts | `lightweight-charts` v4, 6 intervals (1m–1d), 20+ technical indicators |
| Multi-market watchlist | Core perpetuals curated (BTC, ETH, SOL, STRK, HYPE) |
| Market screener | Sortable columns, tab-based filtering, favorites |
| Orderbook depth | Bid/ask aggregation with configurable levels |

### Trading
| Feature | Implementation |
|---------|---------------|
| Order types | Market, Limit, Stop, Stop-Limit, Bracket, OCO |
| Multi-DEX routing | Smart order router with price/liquidity analysis |
| Paradex integration | Full REST + WebSocket, testnet/mainnet, Starknet key signing |
| Extended Exchange | REST client with API-key auth |
| Position management | Real-time PnL, margin, leverage, batch operations |

### Performance
| Metric | Target |
|--------|--------|
| WebSocket RTT | < 50ms (p95) |
| Frame rate | 60 FPS sustained, 30 FPS minimum |
| Initial bundle | < 200 KB (gzipped) |
| Chart render | < 16ms per frame |
| Orderbook flush | 50ms batch window |

### Security
- **Authentication**: SNIP-12 typed-data signing over Starknet wallets
- **Private keys**: Never stored or transmitted; all signing happens in-wallet
- **JWT**: Short-lived tokens with token-version based invalidation
- **Rate limiting**: Redis-backed token bucket, 120 req/min per IP
- **Auth strict mode**: Optional second-factor enforcement
- **CSP headers**: Via `@fastify/helmet`
- **Input validation**: Zod schemas on every API endpoint

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Command Palette |
| `Ctrl+T` | Toggle Theme |
| `?` | Shortcuts Help |
| `G T` | Go to Terminal |
| `G M` | Go to Markets |
| `G P` | Go to Portfolio |
| `B` / `S` | Focus Buy / Sell |
| `M` / `L` | Market / Limit order |
| `Enter` | Submit order |

---

## Documentation

| Document | Audience | Content |
|----------|----------|---------|
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | Engineers | Full system architecture, state management strategy, WebSocket pipeline, render performance model, technical decisions with rationale |
| **[QUICKSTART.md](./QUICKSTART.md)** | Users | Detailed setup, configuration, troubleshooting |
| **[docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)** | Ops | Railway deployment, Docker orchestration, CI/CD pipeline |
| **[docs/PERFORMANCE.md](./docs/PERFORMANCE.md)** | Engineers | Rendering pipeline, virtualization strategy, bundle optimization, memory profiling |
| **[docs/SECURITY.md](./docs/SECURITY.md)** | All | Authentication flow, threat model, key management, rate limiting design |
| **[CONTRIBUTING.md](./CONTRIBUTING.md)** | Contributors | Code style, commit conventions, PR process, performance budgets |
| **[LICENSE](./LICENSE)** | Legal | MIT License |

---

## Deployment

### Railway (API + WS)

```bash
railway up --service api --path-as-root apps/api
railway up --service ws --path-as-root apps/ws
```

Each service uses an optimized multi-stage Dockerfile with production-only dependency installation. The API runs Prisma migrations via Railway's `releaseCommand` before accepting traffic. Both services respect Railway's dynamic `PORT` assignment.

### Vercel (Web)

The frontend is independently deployed on Vercel. See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for environment variable configuration.

### Docker Compose (Local)

```bash
docker compose up -d    # Starts postgres, redis, api, ws, web
```

---

## Tech Stack & Rationale

| Layer | Choice | Why |
|-------|--------|-----|
| **Frontend Framework** | React 18 | Mature ecosystem, concurrent mode for high-frequency updates |
| **Build Tool** | Vite 7 | Sub-second HMR, aggressive code-splitting, Tailwind v4 integration |
| **State Management** | Zustand 5 | 1 KB, selector-based subscriptions, no Provider tree, devtools |
| **Server State** | TanStack Query 5 | Request dedup, stale-while-revalidate, optimistic updates |
| **Charts** | lightweight-charts v4 | Purpose-built for financial data, hardware-accelerated, 60 FPS at 10K+ candles |
| **API Framework** | Fastify 5 | Lowest overhead Node.js framework (≈15ms p99 latency at 1K req/s) |
| **ORM** | Prisma 6 | Type-safe queries, migrations, studio for ad-hoc debugging |
| **WebSocket** | ws (native) | 0-dependency, full control over reconnection, binary framing for msgpack |
| **Styling** | Tailwind CSS 4 | Zero-runtime CSS, design token system, effective bundle purging |
| **Auth** | SNIP-12 + JWT | Starknet native signing standard, no password storage |

---

## Principal Engineering Decisions

1. **Why not Socket.io?** — Socket.io adds 30 KB+ and fallback polling. For a trading terminal, raw WebSocket gives us full control over reconnection with exponential-backoff-with-jitter, msgpack binary encoding (≈60% size reduction on orderbook deltas), and integration with requestAnimationFrame scheduling.

2. **Why Zustand over Redux?** — Zustand's selector-based subscriptions mean each component subscribes only to its data slice. A position list component re-renders only when a position changes, not when the orderbook updates. This selective subscription is critical for maintaining 60 FPS with 5+ simultaneous data streams.

3. **Why 50ms batching?** — Orderbook updates arrive at up to 100 msg/s. Rendering each update individually causes layout thrashing. A 50ms flush window aggregates deltas into a single batched store update, giving React a single reconciliation pass. This is the key mechanism keeping frame time under 16ms.

4. **Why multi-DEX over single-DEX?** — No single Starknet DEX offers full market coverage + competitive fees + deep liquidity simultaneously. Our OrderRouter analyzes price, liquidity, and fee structures across Paradex and Extended, routing each leg to the optimal venue.

5. **Why Prisma over raw SQL?** — For a complex domain model (users, preferences, alerts, notifications, trade records, audit logs), Prisma's type safety eliminates an entire class of SQL injection and type coercion bugs. The migration framework provides reproducible schema evolution across dev → staging → production.

---

## Project Status

- **API**: Production-ready. Fastify 5, Prisma 6, dual-DEX clients, comprehensive auth.
- **WebSocket**: Production-ready. JWT-authenticated channels, Redis pub/sub scaling, Paradex WS bridge with auto-reconnect.
- **Frontend**: Production-ready. 80+ components, 18 hooks, 11 Zustand stores, full test suite.
- **CI/CD**: GitHub Actions with lint, typecheck, test (web + api), build, and security audit jobs.
- **Infrastructure**: Docker Compose for local dev, Railway for API/WS, Vercel for web.

---

<p align="center">
  <a href="https://hyperx.io">Website</a> •
  <a href="https://github.com/hyperx/terminal">GitHub</a> •
  <a href="https://docs.hyperx.io">Docs</a> •
  <a href="https://discord.gg/hyperx">Discord</a>
</p>

<p align="center">
  <sub>Built with discipline. MIT License.</sub>
</p>
