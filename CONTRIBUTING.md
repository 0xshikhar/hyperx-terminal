# Contributing to HyperX Terminal

> Thank you for contributing to the HyperX Terminal — a high-performance trading interface for the Starknet ecosystem.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Development Setup](#development-setup)
3. [Project Architecture](#project-architecture)
4. [Code Style](#code-style)
5. [Testing](#testing)
6. [Performance Budgets](#performance-budgets)
7. [Pull Request Process](#pull-request-process)
8. [Adding a New Feature](#adding-a-new-feature)
9. [Adding a New API Endpoint](#adding-a-new-api-endpoint)
10. [Security](#security)

---

## Quick Start

```bash
git clone <repo-url>
cd hyperx-terminal
pnpm install
cp .env.example .env                     # Edit DATABASE_URL, JWT_SECRET
pnpm prisma:migrate
pnpm dev
```

See [QUICKSTART.md](./QUICKSTART.md) for detailed setup instructions.

---

## Development Setup

### Prerequisites

- Node.js >= 22.0.0
- pnpm >= 10.0.0
- PostgreSQL >= 14
- Redis >= 7 (optional)

### Environment

```bash
cp .env.example .env
# Required:
#   DATABASE_URL=postgresql://user:pass@localhost:5432/hyperx
#   JWT_SECRET=<generated-with-openssl-rand-base64-32>

cp apps/web/.env.example apps/web/.env   # if it exists
#   VITE_API_URL=http://localhost:3001
#   VITE_WS_URL=ws://localhost:3002
```

### Running Tests

```bash
pnpm test          # All tests
pnpm test:web      # Frontend (Vitest + jsdom)
pnpm test:api      # API (requires PostgreSQL)
pnpm test:coverage # With coverage report
```

---

## Project Architecture

```
apps/
  api/     Fastify 5 REST server with Prisma 6 (PostgreSQL)
           └── JWT auth via Starknet wallet signing (SNIP-12)
  ws/      WebSocket server (native ws library)
           └── Redis pub/sub for horizontal scaling
  web/     React 18 SPA (Vite 7 + Tailwind 4 + Zustand 5)
           └── 11 Zustand stores, 18 custom hooks, 80+ components
packages/
  types/   Shared TypeScript types
           ├── api/          REST DTOs
           ├── websocket/    WS message schemas
           ├── dex/          DEX integration interfaces
           └── common/       Enums, market helpers
```

For a deep understanding of the architecture, read [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Code Style

### TypeScript

- **Strict mode**: Enabled across all packages
- **Interfaces over types**: Prefer `interface` for object shapes, `type` for unions/intersections
- **Explicit return types**: Required on all exported functions
- **No `any`**: Use `unknown` with type guards. Exceptions documented with `// eslint-disable-next-line @typescript-eslint/no-explicit-any`
- **Path aliases**: `@/*` → `apps/web/src/*`, `~/*` → `apps/web/src/*`

### React

- **Functional components only**: No class components
- **Hooks over HOCs**: Prefer custom hooks for shared logic
- **Zustand for global state**: Only global data (market data, auth, positions)
- **useState for local state**: UI-specific state stays in the component
- **URL for shareable state**: Market selection, page navigation

### Styling

- **Tailwind CSS v4**: All styles in utility classes
- **CSS variables for dynamic values**: Theme colors, spacing
- **No runtime CSS-in-JS**: Tailwind is zero-runtime
- **Design tokens**: Use the established color palette:
  - Background: `#081214`
  - Surface: `#0a1518` / `#0c181b`
  - Accent: `#53d8c8` (teal, positive/actions)
  - Negative: `#f16d75` (red, losses/errors)
  - Warning: `#f7c96b` (amber, caution)

### Conventions

```typescript
// Component file: PascalCase
// apps/web/src/components/orderbook/OrderBook.tsx

// Hook file: camelCase with 'use' prefix
// apps/web/src/hooks/useOrderBook.ts

// Store file: camelCase with 'Store' suffix
// apps/web/src/store/orderbookStore.ts

// API route file: camelCase
// apps/api/src/routes/auth.ts
```

---

## Testing

### Strategy

| Layer | Tool | Scope |
|-------|------|-------|
| Unit | Vitest | Utilities, hooks, pure functions |
| Integration | React Testing Library | Component interaction, stores |
| E2E | Playwright (planned) | Critical user paths |

### Guidelines

- **Test behavior, not implementation** — What it does, not how it does it
- **Arrange-Act-Assert** — Clear structure for every test
- **Mock external dependencies** — API calls, WebSocket, wallet connections
- **Name tests meaningfully** — `describe('OrderBook', () => { it('renders bids sorted by price descending', ...) })`
- **Coverage target**: 80% for utilities, 60% for components, 90% for API services

### Writing Tests

```typescript
// Component test example
describe("TradeForm", () => {
  it("validates order before submission", async () => {
    render(<TradeForm market="BTC-USD" />);

    await user.click(screen.getByRole("button", { name: /buy/i }));

    expect(screen.getByText(/size is required/i)).toBeInTheDocument();
  });
});
```

---

## Performance Budgets

HyperX Terminal has strict performance requirements. Every contribution must respect these budgets:

| Metric | Target | CI Enforcement |
|--------|--------|----------------|
| Initial JS bundle (gzip) | < 200 KB | Bundle analysis |
| Frame rate during updates | > 55 FPS | Manual review |
| WS update → store apply | < 5ms | Manual review |
| Component re-render | Only on relevant state change | Manual review |

### Guidelines

- **React.memo**: Wrap components receiving frequent prop updates (orderbook rows, ticker items)
- **useMemo**: Cache expensive array/object transformations (order aggregation, market filtering)
- **Zustand selectors**: Always read the minimum state slice needed
- **Virtualization**: Use `react-window` for lists exceeding 100 items
- **No inline functions in render props**: Extract to memoized callbacks

---

## Pull Request Process

### Before Submitting

1. Run `pnpm typecheck` — zero errors required
2. Run `pnpm lint` — zero warnings required
3. Run `pnpm test` — all tests passing
4. Run `pnpm build` — all services building

### PR Description Template

```markdown
## Summary
Brief description of the change

## Motivation
Why this change is needed

## Testing
How was this tested?

## Performance Impact
- [ ] No measurable impact
- [ ] Improves performance (describe)
- [ ] Regresses performance (justify)

## Documentation
- [ ] README updated
- [ ] ARCHITECTURE.md updated (if applicable)
- [ ] JSDoc added for new public APIs
```

### Review Requirements

- At least one maintainer approval
- All CI checks passing
- Performance impact assessed (for real-time data changes)
- No regression on existing tests

---

## Adding a New Feature

### Frontend Component

```bash
# 1. Create component
apps/web/src/components/my-feature/MyFeature.tsx
apps/web/src/components/my-feature/MyFeature.test.tsx

# 2. If it needs global state, create or update a Zustand store
apps/web/src/store/myFeatureStore.ts

# 3. If it needs data from the server:
#    a. Add API endpoint
#    b. Add API client method
#    c. Add WS channel (if real-time)
#    d. Create or update a React hook

# 4. Register keyboard shortcut (if applicable)
#    apps/web/src/hooks/useKeyboardShortcuts.tsx

# 5. Add to command palette (if applicable)
#    apps/web/src/components/command-palette/CommandPalette.tsx
```

### API Endpoint

```typescript
// apps/api/src/routes/myFeature.ts
import { FastifyInstance } from "fastify";
import { z } from "zod";

const myFeatureSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function myFeatureRoutes(app: FastifyInstance) {
  app.post("/api/my-feature", {
    schema: { body: myFeatureSchema },
    handler: async (req, reply) => {
      const { name } = myFeatureSchema.parse(req.body);
      const result = await prisma.myFeature.create({ data: { name } });
      return { data: result };
    },
  });
}
```

### WebSocket Channel

```typescript
// apps/ws/src/index.ts — add to subscribeSchema
const subscribeSchema = z.object({
  channels: z.array(z.object({
    channel: z.union([
      z.literal("my-channel"),
      // ...existing channels
    ]),
  })),
});

// apps/web/src/services/wsClient/channelTypes.ts — add channel type
export type ChannelType = "ticker" | "orderbook" | "trades" | "my-channel";
```

---

## Security

- **Never commit secrets** — No API keys, JWT secrets, or database URLs in code
- **All input validated** — Every endpoint uses Zod schemas
- **Auth-gated user data** — Any endpoint accessing user data uses `requireAuth`
- **Rate limiting** — Public endpoints must be rate-limited
- **Cookie flags** — Auth cookies must be `httpOnly`, `secure`, `sameSite: lax`
- **Dependencies** — Lockfile must be committed. Don't add new dependencies without review.

See [docs/SECURITY.md](./docs/SECURITY.md) for the complete security architecture.

---

## Documentation

When making changes, update the relevant documentation:

| Change | Document to Update |
|--------|-------------------|
| New frontend feature | Component README or JSDoc |
| New API endpoint | `packages/types/src/api/index.ts` |
| New WS channel | `packages/types/src/websocket/index.ts` |
| Architecture change | `ARCHITECTURE.md` |
| Deployment change | `docs/DEPLOYMENT.md` |
| Security change | `docs/SECURITY.md` |

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License. See [LICENSE](./LICENSE).

---

*For a complete architectural reference, see [ARCHITECTURE.md](./ARCHITECTURE.md). For performance deep-dive, see [docs/PERFORMANCE.md](./docs/PERFORMANCE.md).*
