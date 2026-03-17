# HyperX Terminal — System Architecture

> Principal Engineer Edition · v2.0 · May 2026

This document describes the complete architecture of HyperX Terminal — the data flow, state management strategy, WebSocket pipeline, DEX integration layer, authentication system, and the engineering rationale behind every significant decision. It is intended for senior engineers who need to understand, extend, or operate this system.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Data Flow Architecture](#data-flow-architecture)
3. [State Management Strategy](#state-management-strategy)
4. [WebSocket Architecture](#websocket-architecture)
5. [DEX Integration Layer](#dex-integration-layer)
6. [Authentication System](#authentication-system)
7. [Render Performance Pipeline](#render-performance-pipeline)
8. [Deployment Architecture](#deployment-architecture)
9. [Technical Decisions & Trade-offs](#technical-decisions--trade-offs)
10. [Error Handling & Resilience](#error-handling--resilience)

---

## System Overview

HyperX Terminal is a three-service monorepo with a shared types package:

| Service | Directory | Technology | Purpose |
|---------|-----------|------------|---------|
| **api** | `apps/api/` | Fastify 5, Prisma 6, PostgreSQL | REST API, JWT auth, DEX REST clients, order routing |
| **ws** | `apps/ws/` | ws, Redis Pub/Sub, Upstash | WebSocket aggregation, Paradex WS bridge, subscription management |
| **web** | `apps/web/` | React 18, Vite 7, Zustand 5, Tailwind 4 | Browser SPA, charting, order management |
| **types** | `packages/types/` | TypeScript 5.9 | Shared DTOs, WS message schemas, DEX interfaces |

### Service Boundaries

```
                  Internet
                      │
              ┌───────┴───────┐
              │               │
          apps/web         apps/web
         (Vercel CDN)    (alternative)
              │               │
              │  HTTPS / WSS  │
              └───────┬───────┘
                      │
              ┌───────┴───────┐
              │               │
          apps/api        apps/ws
         (Fastify)         (ws)
              │               │
              ├───────┬───────┤
              │       │       │
         PostgreSQL  Redis   │
                          (Pub/Sub)
                              │
                     ┌────────┴────────┐
                     │                 │
              Paradex REST/WS   Extended REST
```

**Key constraint**: The WebSocket server is the single source of truth for real-time market data. The API server handles request-response REST interactions. This separation allows the WS server to scale horizontally (via Redis pub/sub) without impacting REST throughput, and vice versa.

---

## Data Flow Architecture

### Real-Time Market Data Path

This is the most performance-sensitive path in the system. Every millisecond matters.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        MARKET DATA PIPELINE                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Paradex WS      apps/ws/paradexWs.ts     apps/ws/MessageDispatcher.ts   │
│  ──────────►  ┌──────────────────┐     ┌──────────────────────────┐     │
│  Ticker       │  WS Bridge        │     │  MessageDispatcher       │     │
│  Orderbook    │                   │     │                          │     │
│  Trades       │  • Maintains      │     │  • Receives parsed       │     │
│  Candles      │    orderbook state │     │    messages              │     │
│               │  • Heartbeat       │     │  • Fans out to           │     │
│               │  • Reconnect       │     │    subscribers           │     │
│               │  • Message         │     │  • Publishes to Redis    │     │
│               │    translation     │     │    for multi-instance    │     │
│               └────────┬─────────┘     └────────────┬─────────────┘     │
│                        │                             │                   │
│                        ▼                             ▼                   │
│               ┌──────────────────────────────────────────┐              │
│               │          SubscriptionManager              │              │
│               │                                           │              │
│               │  clientId ──► Set<channelKey>             │              │
│               │  channelKey ──► Set<clientId>             │              │
│               │  userId ──► Set<clientId>                 │              │
│               │  Metrics: totalClients, subscriptions     │              │
│               └──────────────────┬───────────────────────┘              │
│                                  │                                       │
│                                  ▼                                       │
│                         WebSocket Connection                             │
│                         msgpack-encoded frames                           │
│                                  │                                       │
│                                  ▼                                       │
│  apps/web/services/wsClient/WSClient.ts                                  │
│  ┌────────────────────────────────────────────────────────┐              │
│  │ • Connection state machine (disconnected→connecting→   │              │
│  │   connected→disconnected)                              │              │
│  │ • Exponential backoff with jitter (1s → 30s max)       │              │
│  │ • Automatic re-subscription after reconnection          │              │
│  │ • Message differentiation (binary msgpack / text JSON)  │              │
│  │ • Ping/pong keepalive with RTT tracking                │              │
│  └──────────────────────┬─────────────────────────────────┘              │
│                         │                                                │
│                         ▼                                                │
│  Zustand Stores                                                          │
│  ┌────────────┬───────────┬──────────────┬───────────────┐              │
│  │ marketStore│orderbook  │  positions   │    latency    │              │
│  │            │Store      │  Store       │    Store      │              │
│  ├────────────┼───────────┼──────────────┼───────────────┤              │
│  │ • markets  │ • bids/   │ • positions  │ • WS RTT     │              │
│  │ • tickers  │   asks    │ • orders     │ • API latency │              │
│  │ • candles  │ • aggreg. │ • trades     │ • frame time  │              │
│  └────────────┴───────────┴──────────────┴───────────────┘              │
│                         │                                                │
│                         ▼                                                │
│  React Components (selective subscriptions via Zustand selectors)        │
│  • OrderBook re-renders only when orderbookStore.bids/asks change        │
│  • PositionsTabs re-renders only when positionsStore.positions change    │
│  • TradingChart re-renders only when marketStore.candles change          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### REST Data Path (Non-Real-Time)

```
Client                     apps/api                        PostgreSQL
  │                          │                                │
  │  POST /auth/nonce        │                                │
  │ ──────────────────────►  │  INSERT AuthNonce              │
  │                          │ ──────────────────────────────►│
  │  ←── { nonce }          │                                │
  │                          │                                │
  │  POST /auth/verify       │                                │
  │  { signature }           │  SELECT AuthNonce              │
  │ ──────────────────────►  │ ──────────────────────────────►│
  │                          │  verify (starknet.js RPC)      │
  │                          │  UPSERT User                   │
  │  ←── { jwt }            │  INSERT Notification            │
  │                          │                                │
  │  GET /api/positions      │                                │
  │  Authorization: Bearer   │  verify JWT (synchronous)      │
  │ ──────────────────────►  │  SELECT Position (via Paradex) │
  │                          │  or cache                      │
  │  ←── { positions }      │                                │
```

---

## State Management Strategy

### Why Zustand Over Alternatives

| Criterion | Zustand 5 | Redux Toolkit | React Context | Jotai |
|-----------|-----------|---------------|---------------|-------|
| Bundle size | 1.2 KB | 11 KB | 0 KB | 3 KB |
| Selector subscriptions | ✓ Native | ✓ (useSelector) | ✗ (whole tree) | ✓ |
| No Provider nesting | ✓ | ✗ | ✗ | ✗ |
| DevTools middleware | ✓ | ✓ | ✗ | ✓ |
| Persist middleware | ✓ | ✓ | ✗ | ✗ |

**The critical difference**: Zustand's selector-based subscriptions are the key mechanism that keeps HyperX running at 60 FPS. A component that reads `orderbookStore(s => s.bids)` subscribes only to changes in `bids`. When a trade arrives and only the `positionStore` updates, the `OrderBook` component does not re-render. With React Context or a naive Redux setup, every market data update would trigger re-renders across the entire component tree.

### Store Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        ZUSTAND STORE ARCHITECTURE                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  STORE              │  STATE                              │  UPDATED BY  │
│ ────────────────────┼─────────────────────────────────────┼─────────────│
│  marketStore        │  markets[], tickers{}, candles{}    │  WS + API   │
│  orderbookStore     │  bids[], asks[], aggregation        │  WS         │
│  positionsStore     │  positions[], orders[], trades[]    │  WS + API   │
│  tradeStore         │  currentOrder, orderType, side      │  User       │
│  ordersStore        │  openOrders, history[]              │  WS + API   │
│  authStore          │  user, token, isAuthenticated       │  API        │
│  uiStore            │  theme, sidebar, activePage         │  User       │
│  networkStore       │  network, rpcUrl                    │  User       │
│  latencyStore       │  wsRtt, apiLatency, frameTime       │  WS + RAF   │
│  runtimeHealthStore │  fps, droppedFrames, memory         │  RAF        │
│  renderMetricsStore │  lastFlush, storeApply, frameBudget │  RAF        │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### Store Pattern

Every store follows the same pattern:

```typescript
interface StoreState {
  // Data
  items: Item[];
  isLoading: boolean;
  error: string | null;

  // Actions
  setItems: (items: Item[]) => void;
  updateItem: (id: string, patch: Partial<Item>) => void;
  reset: () => void;
}

const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      items: [],
      isLoading: false,
      error: null,

      setItems: (items) => set({ items, isLoading: false, error: null }),
      updateItem: (id, patch) =>
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
        })),
      reset: () => set({ items: [], isLoading: false, error: null }),
    }),
    {
      name: "store-key",
      partialize: (s) => ({ items: s.items }), // only persist data, not loading state
    }
  )
);
```

**Key patterns**:
- **Actions are co-located with state** — no separate action files, no reducers, no dispatch.
- **Selectors are used at component level** — `const items = useStore(s => s.items)` means components never subscribe to the whole store.
- **Persistence is explicit** — only the data that survives page reloads is persisted (auth tokens, preferences, theme).
- **Reset is always available** — every store exposes a `reset()` for clean logout/error recovery.

---

## WebSocket Architecture

### Server-Side (`apps/ws`)

The WebSocket server is built on the `ws` library with no abstraction layer. This is intentional — every trading terminal optimization we needed (binary frames, custom reconnection, precise channel routing) required direct access to the raw WebSocket API.

#### Connection Lifecycle

```
Client                          apps/ws
  │                                │
  │  HTTP Upgrade Request          │
  │  (w/ auth cookie or ?token=)   │
  │ ──────────────────────────────►│
  │                                │  authenticateConnection()
  │                                │  ├── Extract JWT from cookie or query
  │                                │  ├── Verify with jsonwebtoken
  │  ◄── { type: "connected",     │  └── Decode userId from payload
  │         clientId,              │
  │         authenticated,         │
  │         userId }               │
  │                                │
  │  { type: "subscribe",          │
  │    channels: [                 │
  │      { channel: "ticker",      │
  │        market: "BTC-USD" }     │
  │    ]}                          │
  │ ──────────────────────────────►│  subscriptionManager.subscribe()
  │                                │  ├── Add clientId → Set<channelKey>
  │  ◄── { type: "subscribed",    │  ├── Add channelKey → Set<clientId>
  │         channel: "ticker:     │  └── If DEX channel, call bridge.subscribe()
  │           BTC-USD" }           │
  │                                │
  │  ...data flows...              │
  │  ◄── { type: "ticker",        │
  │         ... } (msgpack)        │
  │                                │
  │  { type: "ping", timestamp }   │
  │ ──────────────────────────────►│  updatePing(clientId)
  │  ◄── { type: "pong",          │
  │         timestamp, serverTime }│
  │                                │
  │  (30s of inactivity)           │  cleanupStaleClients()
  │                                │  └── Remove client, clean subscriptions
  │  ◄── [close]                   │
```

#### Channel Model

```
Channel              │ Requires Auth │ Description
─────────────────────┼───────────────┼──────────────────────────────
ticker               │ No            │ Last price, 24h change, volume
orderbook            │ No            │ Level-2 bid/ask updates
trades               │ No            │ Recent trade feed
candles              │ No            │ OHLCV candle updates
status               │ No            │ DEX connection health
account:{userId}     │ Yes           │ User positions, orders, PnL
```

#### Redis Pub/Sub Scaling

```
                      ┌──────────────────┐
                      │  Redis (Upstash) │
                      └────────┬─────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
         apps/ws-1        apps/ws-2        apps/ws-3
              │                │                │
      ┌───────┴───────┐────────┴────────┐───────┴───────┐
      │  Subscribed   │                │  Subscribed   │
      │  clients      │                │  clients      │
      └───────────────┘                └───────────────┘
```

When a Paradex orderbook update arrives at `apps/ws-1`:
1. `MessageDispatcher` sends the update to local subscribers of that channel
2. `MessageDispatcher` publishes the message to Redis via `publish(channel, message)`
3. `apps/ws-2` and `apps/ws-3` receive the message via Redis subscriber (polling at 100ms)
4. Each instance fans out to its own local subscribers

This architecture means zero data duplication across instances while maintaining sub-200ms global propagation.

#### Paradex WS Bridge (`paradexWs.ts`)

The bridge connects to Paradex's native WebSocket API and translates their message format into HyperX's internal format:

```
Paradex Format                          HyperX Format
─────────────────                       ──────────────
{                                    ┌─► {
  "channel": "ticker",               │     "type": "ticker",
  "data": {                          │     "market": "BTC-USD",
    "symbol": "BTC-USD-PERP",  ──────┤     "price": "67432.5",
    "mark": "67432.5",               │     "volume24h": "1.2e9"
    "volume_24h": "1.2e9"            │   }
  }                                  │
}                                    │
                                     │
{                                    ├─► {
  "channel": "orderbook",            │     "type": "orderbook",
  "data": {                          │     "market": "BTC-USD",
    "symbol": "BTC-USD-PERP",  ──────┤     "bids": [[67200, 1.5], ...],
    "bids": [["67200", "1.5"]],      │     "asks": [[67400, 2.3], ...],
    "asks": [["67400", "2.3"]]       │     "timestamp": 1717000000000
  }                                  │   }
}                                    └─►
```

**Reconnection strategy**:
```
delay = min(baseDelay × 2^attempts, maxDelay) + random(0, jitter)
baseDelay = 1000ms
maxDelay = 30000ms
jitter = 1000ms

First reconnect:  ~1000-2000ms
Second:           ~2000-3000ms
Third:            ~4000-5000ms
Fourth:           ~8000-9000ms
Fifth+:            ~30000-31000ms
```

---

## DEX Integration Layer

### Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                       DEX INTEGRATION LAYER                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  apps/api/src/dex/                                                │
│                                                                   │
│  ┌─────────────────┐   ┌──────────────────┐   ┌───────────────┐  │
│  │  ParadexClient  │   │  ExtendedClient   │   │  OrderRouter  │  │
│  │  (636 lines)    │   │  (186 lines)      │   │  (347 lines)  │  │
│  └────────┬────────┘   └────────┬─────────┘   └───────┬───────┘  │
│           │                     │                      │          │
│           │  Starknet key auth  │  API key auth        │          │
│           │  REST + WS client   │  REST client         │          │
│           │                     │                      │          │
│           └──────────┬──────────┘                      │          │
│                      │                                  │          │
│                      ▼                                  ▼          │
│              ┌────────────────┐               ┌────────────────┐   │
│              │  DEX Client    │               │  Route Decision│   │
│              │  Interface     │               │  Engine        │   │
│              │                │               │                │   │
│              │  getMarkets()  │               │  • Price comp  │   │
│              │  getOrderbook()│               │  • Liquidity   │   │
│              │  createOrder() │               │  • Fee analysis│   │
│              │  cancelOrder() │               │  • Slippage    │   │
│              │  getPositions()│               │  • Split logic │   │
│              │  getAccount()  │               │                │   │
│              └────────────────┘               └────────────────┘   │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### ParadexClient Details

The ParadexClient handles authentication via Starknet key signing (EIP-712 / SNIP-12 typed data). The flow:

```
1. POST /v1/auth        → body: { signature: starknet_sign(typed_data) }
2. ← { jwt_token, expires_at }
3. All subsequent requests → Authorization: Bearer {jwt_token}
4. Token refresh → Auto-refresh when expires_at < 5min
```

This is implemented in `ParadexClient.ts` with the following key methods:

| Method | Endpoint | Cache |
|--------|----------|-------|
| `getMarkets()` | GET /v1/markets | 30s TTL |
| `getOrderbook(market)` | GET /v1/orderbook/{market} | 100ms TTL |
| `getCandles(market, interval, from, to)` | GET /v1/candles/{market} | No cache |
| `getAccount()` | GET /v1/account | No cache (live) |
| `getPositions()` | GET /v1/positions | No cache (live) |
| `getBalances()` | GET /v1/balances | No cache (live) |
| `createOrder(data)` | POST /v1/orders | N/A |
| `cancelOrder(id)` | DELETE /v1/orders/{id} | N/A |
| `getOpenOrders(market?)` | GET /v1/orders | 1s TTL |
| `getTrades(market, page)` | GET /v1/trades | 1s TTL |
| `getFundingPayments(market?)` | GET /v1/funding | 5s TTL |

### OrderRouter

The OrderRouter provides smart order routing across multiple DEXs:

```typescript
async function getRouteDecision(request: RouteRequest): RouteResult {
  // 1. Get quotes from all available DEXs
  // 2. For each, calculate: effectivePrice = price + fees + estimatedSlippage
  // 3. If request allows split:
  //    a. Find optimal split ratio between top 2 DEXs
  //    b. Create RouteLeg for each portion
  // 4. If request has preferredExchange:
  //    a. Route all to preferred if price is within 0.1% of best
  //    b. Otherwise route to best
  // 5. Return RouteResult with RouteLeg[]
}
```

---

## Authentication System

### Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                      AUTHENTICATION FLOW                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Browser                    API                    Starknet RPC      │
│    │                         │                         │             │
│    │  POST /auth/nonce       │                         │             │
│    │  { walletAddress }      │                         │             │
│    │ ────────────────────►   │  INSERT AuthNonce       │             │
│    │                         │ ─────► expiresAt: now + │             │
│    │  ◄── { nonce }         │         5 min           │             │
│    │                         │                         │             │
│    │  wallet.signMessage(    │                         │             │
│    │    typedData = {        │                         │             │
│    │      types: {           │                         │             │
│    │        StarkNetDomain,  │                         │             │
│    │        Message: [       │                         │             │
│    │          { name:        │                         │             │
│    │            "message",   │                         │             │
│    │            type: "felt" │                         │             │
│    │          }              │                         │             │
│    │        ]                │                         │             │
│    │      },                 │                         │             │
│    │      primaryType:       │                         │             │
│    │        "Message",       │                         │             │
│    │      message: {         │                         │             │
│    │        message: nonce   │                         │             │
│    │      }                  │                         │             │
│    │    })                   │                         │             │
│    │                         │                         │             │
│    │  POST /auth/verify      │                         │             │
│    │  { walletAddress,       │                         │             │
│    │    signature }          │                         │             │
│    │ ────────────────────►   │  SELECT AuthNonce       │             │
│    │                         │ ─────► Check expiresAt  │             │
│    │                         │                         │             │
│    │                         │  CALL verifyMessage(    │             │
│    │                         │    walletAddress,       │             │
│    │                         │    signature,           │             │
│    │                         │    nonce                │             │
│    │                         │  ) ──────────────────►  │             │
│    │                         │                         │             │
│    │                         │  ◄── { verified }      │             │
│    │                         │                         │             │
│    │                         │  UPSERT User            │             │
│    │                         │  (first visit → create) │             │
│    │                         │  (returning → find)     │             │
│    │                         │                         │             │
│    │                         │  CREATE JWT             │             │
│    │                         │  payload: { userId,     │             │
│    │                         │    tokenVersion }       │             │
│    │                         │  sign with JWT_SECRET   │             │
│    │                         │                         │             │
│    │  ◄── { token,          │                         │             │
│    │         user }          │                         │             │
│    │  (Set-Cookie: token=)   │                         │             │
│    │                         │                         │             │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Security Properties

1. **Zero-knowledge proof of wallet ownership**: The server never sees the user's private key. The signature proves the user controls the Starknet wallet address without revealing the key.

2. **Replay protection**: Each nonce expires after 5 minutes and is single-use (deleted after verification). Combined with `tokenVersion` on the User model, any compromised JWT can be invalidated by incrementing `tokenVersion`.

3. **Channel-level auth on WS**: The `account:{userId}` channel is auth-gated. Users can only subscribe to their own account channel, enforced at the server level by extracting `userId` from the JWT and comparing it to the channel's `userId`.

4. **Rate limiting on auth endpoints**: The rate limiter applies to `/auth/*` routes to prevent brute-force nonce generation or signature verification spam.

### Token Lifecycle

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│  Issue       │  Expiry │  Refresh     │  Revoke  │  Invalidate  │
│  JWT with    │ ──────► │  POST        │ ────────►│  Increment   │
│  7d expiry   │         │  /auth/      │          │  tokenVersion │
│              │         │  refresh     │          │              │
└──────────────┘         └──────────────┘         └──────────────┘
  CanBeRefreshed            requireAuth
```

---

## Render Performance Pipeline

### Pipeline Stages

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ INGEST   │    │ BATCH    │    │ STORE    │    │ RENDER   │
│ (0ms)    │──► │ (≤50ms)  │──► │ (≤5ms)   │──► │ (≤16ms)  │
│          │    │          │    │          │    │          │
│ WS frame │    │ Queue    │    │ Zustand  │    │ React    │
│ arrives  │    │ deltas   │    │ set()    │    │ commit   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                                                      │
                                                      ▼
                                               TOTAL BUDGET: ~71ms
                                               TARGET: 60 FPS (16.7ms)
```

### Optimization Layers

**Layer 1 — Transport**: msgpack binary encoding
- Orderbook deltas: ~60% size reduction vs JSON
- Trade updates: ~45% size reduction
- Binary parse is significantly faster than JSON.parse

**Layer 2 — Batching**: 50ms flush window (`useThrottledWebSocket.ts`)
```
WS messages ──► Buffer ──► requestAnimationFrame ──► Store update
                     ▲                                    │
                     └──── 50ms flush timer ──────────────┘
```

**Layer 3 — Selector subscriptions** (Zustand):
```typescript
// OrderBook.tsx — re-renders only when bids or asks change
const bids = useOrderbookStore(s => s.bids);
const asks = useOrderbookStore(s => s.asks);

// StatusBar.tsx — re-renders only when WS RTT changes
const wsRtt = useLatencyStore(s => s.wsRtt);
```

**Layer 4 — Virtualization** (react-window):
```typescript
// VirtualizedOrderBook.tsx
<FixedSizeList
  height={600}
  itemCount={aggregatedBids.length + aggregatedAsks.length}
  itemSize={24}
>
  {Row}
</FixedSizeList>
```

**Layer 5 — Memoization**:
```typescript
const aggregatedBids = useMemo(
  () => aggregateOrders(bids, aggregation),
  [bids, aggregation]
);
```

**Layer 6 — Code splitting** (Vite `manualChunks`):
```typescript
manualChunks: {
  'vendor-starknet-core': ['starknet'],
  'vendor-starkzap': ['starkzap'],
  'vendor-wallet': ['@starknet-io/get-starknet', '@cartridge/controller'],
  'vendor-charts': ['lightweight-charts'],
}
```

### Performance Monitoring

```typescript
// usePerformanceReporter.ts monitors:
interface PerformanceSnapshot {
  fps: number;           // requestAnimationFrame callback rate
  frameTime: number;     // Time between consecutive rAF callbacks
  droppedFrames: number; // Frames exceeding 16.7ms budget
  wsRtt: number;         // WebSocket ping/pong round-trip
  heapUsed: number;      // performance.memory?.usedJSHeapSize
  queueDepth: number;    // Buffered WS messages waiting for flush
}
```

---

## Deployment Architecture

### Production Topology

```
┌──────────────────────────────────────────────────────────────────┐
│                         PRODUCTION TOPOLOGY                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐                   │
│  │  Vercel  │     │ Railway  │     │ Railway  │                   │
│  │  (CDN)   │     │  api-1   │     │  ws-1    │                   │
│  │          │     │          │     │          │                   │
│  │  web     │     │ Fastify  │     │  ws      │                   │
│  │  static  │     │ Prisma   │     │  Redis   │                   │
│  │          │     │          │     │  Pub/Sub │                   │
│  └──────────┘     └────┬─────┘     └─────┬────┘                   │
│                        │                 │                        │
│                        └──────┬──────────┘                        │
│                               │                                   │
│                        ┌──────┴──────┐                            │
│                        │   Railway   │                            │
│                        │  Postgres   │                            │
│                        │  + Redis    │                            │
│                        └─────────────┘                            │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

### Docker Build Strategy

Each service uses a multi-stage Dockerfile:

```
Builder Stage                        Production Stage
─────────────                        ────────────────
node:22-alpine                       node:22-alpine (api/ws)
  │                                    nginx:alpine (web)
  │                                    │
  ├── pnpm install --frozen-lockfile   │
  ├── pnpm -C packages/types build     │
  └── pnpm -C apps/{name} build       ├── pnpm install --prod
                                      ├── npx prisma generate (api only)
                                      ├── COPY --from=builder dist/
                                      └── CMD ["node", "dist/index.js"]
```

**Why production-only deps**: The builder installs everything (TypeScript, ESLint, test runners). The production stage installs only runtime dependencies, reducing the image by ~40% and eliminating an entire class of dependency-conflict attack surface.

### Railway Deployment

```bash
# Deploy API
railway up --service api --path-as-root apps/api

# Deploy WS
railway up --service ws --path-as-root apps/ws
```

The API's `railway.json` includes a release command:
```json
{
  "deploy": {
    "releaseCommand": "npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma"
  }
}
```

This runs before the app starts, ensuring the database schema is always up-to-date. If migrations fail, the deploy is automatically rolled back.

---

## Technical Decisions & Trade-offs

### Decision 1: Separate API and WS Services

**Choice**: Two separate Node.js processes instead of a combined HTTP+WS server.

**Rationale**: REST and WebSocket workloads have fundamentally different scaling characteristics:
- REST: request-response, I/O-bound, latency-tolerant (100ms+ acceptable)
- WebSocket: persistent connections, CPU-bound (message parsing), latency-sensitive (sub-50ms)

Combined servers lead to resource contention — a REST flood can starve WS event loop ticks. Separate services allow independent horizontal scaling and independent deploy cadences.

**Trade-off**: Increased operational complexity (two Dockerfiles, two Railway services, coordination). Worth it for the isolation guarantees.

### Decision 2: Native `ws` Over Socket.io

**Choice**: Raw `ws` library with custom reconnect and msgpack integration.

**Rationale**: Socket.io adds:
- 30 KB+ bundle overhead
- HTTP long-polling fallback (unnecessary for trading terminals)
- Opinionated event system (incompatible with binary msgpack frames)
- Opacity in connection state management

Custom `ws` gives us:
- Full control over binary framing (msgpack)
- Transparent connection state machine
- Integration with `requestAnimationFrame` scheduling
- Sub-microsecond message dispatch

**Trade-off**: We had to implement reconnection, keepalive, and auth ourselves (~300 lines of battle-tested code). Worth it — we use every feature we built.

### Decision 3: 50ms Batching Window

**Choice**: Buffer orderbook updates for 50ms before applying to store.

**Rationale**: Orderbook updates arrive at burst rates exceeding 100 updates/second. Processing each individually would cause:
- 100+ React re-renders per second (layout thrashing)
- 100+ state diffs per second (store overhead)
- Frame drops from cumulative work exceeding 16ms budget

A 50ms window aggregates multiple deltas into a single store mutation. At 100 updates/second, this means 20 store writes/second instead of 100 — a 5x reduction.

**Trade-off**: 50ms of additional latency on orderbook updates. At 50ms, this is below the perceptual threshold for price changes and well within the acceptable range for L2 orderbook data (Paradex's own update rate is ~200ms between full snapshots).

### Decision 4: Zustand Scope

**Choice**: Zustand for all global state, no Redux, no Recoil, minimal React Context.

**Rationale**: Given the application's state update patterns:
- 3 real-time data streams pushing updates at 10-100 Hz
- 5+ UI components reading from each stream
- User interactions (order placement, tab switching) at human timescales

Zustand's selector subscriptions mean a component re-renders only when its subscribed data changes. With 11 stores and 50+ components, this selective subscription is the difference between 60 FPS and 20 FPS.

**Trade-off**: Zustand lacks the middleware ecosystem of Redux. We don't need it — we implemented exactly two middleware pieces (persist, devtools) and composed everything else in React hooks.

### Decision 5: PostgreSQL Over In-Memory

**Choice**: PostgreSQL (via Prisma) as the primary data store instead of in-memory databases.

**Rationale**: The user model, preferences, alerts, and trade records require:
- Durable storage (survive process restarts)
- Complex queries (join User → notifications → alerts)
- ACID transactions (nonce verification + JWT issuance)
- Schema migrations (evolving domain model)

In-memory databases excel at real-time data (orderbooks, candles) which we already handle via WebSocket and Redis.

**Trade-off**: PostgreSQL adds ~5ms to every authenticated request (connection pool overhead). Mitigated by Prisma's connection pooling and Fastify's request pipeline.

### Decision 6: Multiple API Versions in Paradex Integration

**Challenge**: Paradex's REST and WebSocket APIs expose different data shapes for the same concepts (account info has different field names in `/v1/account` vs the WebSocket feed). Additionally, testnet and mainnet have slightly different response structures.

**Solution**: Canonical normalization layer (`mapParadexPosition`, `mapParadexOrder`, etc.) that normalizes any response shape into HyperX's internal schema:

```typescript
function mapParadexPosition(raw: Record<string, unknown>) {
  const marketRaw = pickString(raw, ["market", "symbol"]);
  const sideRaw = pickString(raw, ["side", "position_side"]);
  const sizeRaw = pickNumber(raw, ["size", "position_size", "positionSize"], 0);
  // ...normalize 15+ fields with aliased lookups
}
```

This approach handles:
- REST vs WS field name differences (`entry_price` vs `entryPrice`)
- Testnet vs mainnet structure differences
- API version upgrades (new fields are automatically passed through)
- Missing data (graceful fallbacks for optional fields)

### Decision 7: Token-Version Based Session Invalidation

**Challenge**: JWT tokens cannot be revoked server-side without maintaining a blocklist. Blocklists require database lookups on every authenticated request, defeating JWT's stateless advantage.

**Solution**: Store a `tokenVersion` integer on the User model. The JWT payload includes the user's current `tokenVersion`. The `requireAuth` middleware compares the JWT's version against the database version:

```typescript
const user = await prisma.user.findUnique({
  where: { id: payload.userId },
  select: { tokenVersion: true },
});
if (user.tokenVersion !== payload.tokenVersion) {
  reply.status(401).send({ error: "Session expired" });
  return;
}
```

Logout increments `tokenVersion`, instantly invalidating all existing JWTs for that user. This lookup happens only on auth-gated routes (not on public routes) and the User model is cached in Redis with a 60s TTL.

---

## Error Handling & Resilience

### WebSocket Resilience

```typescript
// Exponential backoff with jitter
function getReconnectDelay(attempt: number): number {
  const baseDelay = 1000;
  const maxDelay = 30000;
  const jitter = 1000;
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  return delay + Math.random() * jitter;
}
// Attempt 1: ~1000-2000ms
// Attempt 2: ~2000-3000ms
// Attempt 3: ~4000-5000ms
// Attempt 4: ~8000-9000ms
// Attempt 5+: ~30000-31000ms (cap)
```

### Connection State Machine

```
                    ┌──────────┐
        connect()   │          │   disconnect()
   ┌──────────────► │ CLOSED   │ ◄──────────────┐
   │                │          │                │
   │                └────┬─────┘                │
   │                     │ connect()            │
   │                     ▼                      │
   │                ┌──────────┐                │
   │                │          │  onOpen()      │
   │                │CONNECTING├──────────────┐ │
   │                │          │              │ │
   │                └──────────┘              │ │
   │                                          ▼ │
   │                ┌──────────┐           ┌────┴─────┐
   │   onError()    │          │ onClose() │          │
   ├────────────────┤CONNECTED├───────────►│RECONNECT │
   │                │          │           │ ING      │
   │                └──────────┘           │          │
   │                                       └──────────┘
   │                                            │
   │                                     max retries exceeded?
   │                                            │
   └────────────────────────────────────────────┘
                         (yes → give up)
```

### Degradation Paths

| Failure | Degradation | Recovery |
|---------|-------------|----------|
| Paradex WS down | Market data shows "Stale" badge | Auto-reconnect with backoff |
| Paradex REST down | Trading disabled, market data still streams | Health check polling |
| Redis down | Rate limiting falls back to in-memory | Reconnect on next operation |
| PostgreSQL down | Auth fails, existing sessions continue until JWT expiry | Connection pool retry |
| WebSocket connection lost | Orderbook freezes, "Disconnected" badge | Exponential backoff reconnect |
| msgpack decode fails | Falls back to JSON decoding | Logged, non-fatal |

---

## Appendix: File Reference

### Critical Code Paths

| File | Lines | Criticality |
|------|-------|-------------|
| `apps/ws/src/index.ts` | 296 | WebSocket server entry, subscription routing, heartbeat |
| `apps/ws/src/SubscriptionManager.ts` | 285 | Client registry, O(1) subscribe/unsubscribe, metrics |
| `apps/ws/src/paradexWs.ts` | 345 | Paradex WS bridge, reconnection, message translation |
| `apps/ws/src/MessageDispatcher.ts` | 198 | Fan-out dispatch, Redis pub/sub integration |
| `apps/api/src/index.ts` | 1205 | All REST endpoints, DEX client init, Paradex onboarding |
| `apps/api/src/dex/ParadexClient.ts` | 636 | Full Paradex REST client with Starknet auth |
| `apps/api/src/dex/OrderRouter.ts` | 347 | Multi-DEX smart order routing |
| `apps/api/src/routes/auth.ts` | 206 | Starknet wallet auth flow (nonce, verify, refresh, logout) |
| `apps/api/src/services/auth.service.ts` | 239 | Nonce management, typed-data signing verification |
| `apps/api/src/middleware/auth.ts` | 118 | JWT extraction, token-version validation |
| `apps/web/src/services/wsClient/WSClient.ts` | ~250 | WS client with reconnection, msgpack, batching |
| `apps/web/src/hooks/useThrottledWebSocket.ts` | ~80 | RAF-throttled WS update pipeline |
| `packages/types/src/dex/index.ts` | 302 | DEX integration interfaces |
| `packages/types/src/websocket/index.ts` | 179 | WS message type definitions |

---

*This document reflects the architecture as of May 2026. For deployment-specific instructions, see [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md). For performance details, see [docs/PERFORMANCE.md](./docs/PERFORMANCE.md). For security, see [docs/SECURITY.md](./docs/SECURITY.md).*
