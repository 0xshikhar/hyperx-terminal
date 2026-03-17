# HyperX Terminal — Security Architecture

> Authentication flow, threat model, key management, and rate limiting design

---

## Table of Contents

1. [Authentication Flow](#authentication-flow)
2. [JWT Token Design](#jwt-token-design)
3. [Token-Version Invalidation](#token-version-invalidation)
4. [Rate Limiting](#rate-limiting)
5. [Threat Model](#threat-model)
6. [Secure Development Practices](#secure-development-practices)
7. [Operational Security](#operational-security)

---

## Authentication Flow

HyperX implements a **nonce-based challenge-response authentication** using Starknet's SNIP-12 typed-data signing standard. The server never sees or stores user private keys.

### Protocol

```
┌─────────────────────────────────────────────────────────────────────┐
│                     AUTHENTICATION PROTOCOL                           │
│                                                                      │
│  Step 1: Nonce Request                                                │
│  ─────────────────                                                    │
│  Client → Server: POST /auth/nonce { walletAddress }                  │
│  Server:                                                              │
│    1. Generate 31 random bytes → hex → nonce string                  │
│    2. Store AuthNonce { walletAddress, nonce, expiresAt: +5min }     │
│    3. Return { nonce }                                               │
│                                                                      │
│  Step 2: Wallet Signing                                              │
│  ─────────────────────                                              │
│  Client:                                                              │
│    1. Construct SNIP-12 typed data:                                  │
│       {                                                               │
│         types: { Message: [{ name: "message", type: "felt" }] },     │
│         primaryType: "Message",                                       │
│         message: { message: nonce }                                   │
│       }                                                               │
│    2. wallet.signMessage(typedData) → signature                      │
│                                                                      │
│  Step 3: Verification                                                │
│  ────────────────────                                                │
│  Client → Server: POST /auth/verify { walletAddress, signature }      │
│  Server:                                                              │
│    1. Look up AuthNonce by walletAddress                             │
│    2. Check nonce hasn't expired (>5 min since creation)             │
│    3. Verify signature using starknet.js:                             │
│       const verified = await provider.verifyMessage(                  │
│         walletAddress,                                                │
│         typedData,                                                    │
│         signature                                                    │
│       );                                                              │
│    4. If verified:                                                    │
│       a. UPSERT User (first visit → create, returning → find)       │
│       b. Delete AuthNonce (single-use)                               │
│       c. Issue JWT with claims: { userId, tokenVersion }             │
│       d. Set HTTP-only cookie: token={jwt}; Path=/; HttpOnly;        │
│          SameSite=Lax; Max-Age=604800                                │
│       e. Return { token, user }                                      │
│    5. If not verified: return 401                                    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Security Properties

| Property | Mechanism |
|----------|-----------|
| **Zero-knowledge proof** | Server never sees private keys; signature proves wallet ownership |
| **Replay resistance** | Nonces are single-use and expire after 5 minutes |
| **Session invalidation** | `tokenVersion` kills all sessions atomically |
| **Phishing resistance** | Domain-specific typed data prevents cross-site replay |
| **Credential theft** | No passwords stored; wallet signature cannot be reused outside this domain |

---

## JWT Token Design

### Token Structure

```typescript
interface JWTPayload {
  userId: string;        // UUID from User model
  tokenVersion: number;  // Current tokenVersion from User model
  iat: number;           // Issued at (Unix timestamp)
  exp: number;           // Expires at (Unix timestamp, +7 days)
}
```

### Token Lifecycle

```
Issue ──► 7 days ──► Expire
  │                      │
  │ Refresh (within 7d)  │
  │ POST /auth/refresh   │
  │                      │
  │ Logout               │
  │ POST /auth/logout    │
  │ → tokenVersion++     │
  │ → All tokens invalid │
  ▼                      ▼
```

### Cookie Configuration

```typescript
reply.setCookie("token", jwt, {
  httpOnly: true,        // Not accessible via JavaScript (prevents XSS token theft)
  secure: true,          // Only sent over HTTPS
  sameSite: "lax",       // Prevents CSRF on cross-site requests
  path: "/",             // Available to all routes
  maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
});
```

### Middleware Chain

```
Request ──► extractToken() ──► jwtVerify() ──► checkTokenVersion() ──► Route
                │                  │                    │
                │ Cookie           │ Verify             │ Compare JWT's
                │ Authorization    │ signature           │ tokenVersion with
                │ header           │ and expiry          │ User's current
                ▼                  ▼                    ▼
```

---

## Token-Version Invalidation

### Problem

JWT tokens are stateless — once issued, they cannot be revoked without maintaining a server-side blocklist. Blocklists defeat JWT's stateless advantage by requiring a database lookup on every request.

### Solution

Store a `tokenVersion` integer on the `User` model:

```prisma
model User {
  id           String   @id @default(uuid())
  tokenVersion Int      @default(0)
  // ...other fields
}
```

The JWT payload includes the user's `tokenVersion` at issuance. The `requireAuth` middleware compares the JWT's `tokenVersion` against the database:

```typescript
async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  await req.jwtVerify();
  const payload = req.user as JWTPayload;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { tokenVersion: true },
  });

  if (!user || user.tokenVersion !== payload.tokenVersion) {
    reply.status(401).send({ error: "Session expired" });
    return;
  }
}
```

### Invalidation Triggers

| Action | Mechanism |
|--------|-----------|
| Logout | `POST /auth/logout` → increments `tokenVersion` |
| Password change | Not applicable (wallet-based auth) |
| Account suspension | Manual `UPDATE users SET token_version = token_version + 1` |
| Security incident | Bulk token version increment for affected users |

### Performance

- The `tokenVersion` check adds a database lookup on every authenticated request
- Mitigated by: the `User` model is lightweight (no JOINs), Prisma's connection pool, and potential Redis caching with 60s TTL

---

## Rate Limiting

### Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Request   │     │  Token       │     │  Allow/Deny  │
│   Ingress   │────►│  Bucket      │────►│              │
└─────────────┘     │  Algorithm   │     └──────────────┘
                    └──────────────┘
                           │
                    ┌──────┴──────┐
                    │              │
               ┌─────────┐  ┌──────────┐
               │  Redis  │  │ In-      │
               │  (pref) │  │ Memory   │
               │         │  │ (fallback)│
               └─────────┘  └──────────┘
```

### Default Limits

| Route Group | Limit | Window | Scope |
|-------------|-------|--------|-------|
| All routes | 120 requests | 1 minute | Per IP |
| `/auth/*` | 20 requests | 1 minute | Per IP (stricter) |
| Health checks | No limit | — | — |

### Redis-Backed Token Bucket

```typescript
async function checkRateLimit(ip: string): Promise<boolean> {
  if (redis) {
    const key = `ratelimit:${ip}`;
    const current = await redis.incr(key);
    if (current === 1) await redis.expire(key, 60);
    return current <= 120; // 120 requests per minute
  }

  // Fallback: in-memory (per-process, less accurate)
  return memoryRateLimiter.check(ip, 60, 60);
}
```

The Redis-backed implementation is preferred because it's accurate across multiple API instances. The in-memory fallback is conservative (60 req/min vs 120) to account for multiple instances.

---

## Threat Model

### Assets

| Asset | Value | Location |
|-------|-------|----------|
| User JWT tokens | Session access | Browser cookie, PostgreSQL User model |
| User wallet addresses | Public (on-chain) | PostgreSQL User model |
| DEX API keys | Exchange access | Environment variables |
| Paradex Starknet keys | Order placement authority | Environment variables |
| Database | All user data | Railway PostgreSQL |

### Threat Actors

| Actor | Capability | Motivation |
|-------|------------|------------|
| Unauthenticated attacker | Can reach REST/WS endpoints | Data scraping, service disruption |
| Compromised JWT | Full API access as user | Trading on user's behalf |
| Malicious insider | Database access | Data exfiltration |
| Supply chain | Dependency compromise | Code execution |

### Mitigations

| Threat | Mitigation |
|--------|------------|
| JWT theft (XSS) | HTTP-only cookies prevent JS access |
| JWT theft (MITM) | HTTPS everywhere, secure cookie flag |
| CSRF | SameSite=Lax cookie policy |
| API abuse | Rate limiting (Redis-backed token bucket) |
| SQL injection | Prisma parameterized queries (no raw SQL) |
| XSS | Helmet CSP headers, React's built-in sanitization |
| Dependency vulnerability | `pnpm audit` in CI (weekly) |
| Brute-force nonce | Rate limiting on `/auth/*` (20 req/min) |
| Replay attack | Single-use nonces with 5-minute expiry |
| Supply chain | pnpm-lock.yaml frozen installs, minimal `onlyBuiltDependencies` |

### Data Flow Security

```
Browser                              Server
  │                                    │
  │ 1. HTTPS/TLS 1.3                  │
  │ ──────────────────────────────────►│
  │                                    │
  │ 2. Request validation (Zod)       │
  │    → Malformed JSON rejected      │
  │    → Type coercion prevented      │
  │                                    │
  │ 3. JWT verification               │
  │    → Signature check              │
  │    → Expiry check                 │
  │    → Token version check          │
  │                                    │
  │ 4. Rate limit check               │
  │    → Redis token bucket           │
  │    → In-memory fallback           │
  │                                    │
  │ 5. Business logic                 │
  │    → Prisma parameterized queries  │
  │    → Zod response validation      │
  │                                    │
  │ 6. HTTP-only cookie set           │
  │ ◄──────────────────────────────────│
```

---

## Secure Development Practices

### Code Requirements

1. **No secrets in code** — All secrets in environment variables. Never commit `.env`.
2. **Input validation on every endpoint** — Zod schemas validate request body, query params, and URL params before any processing.
3. **Output validation** — All API responses are typed. Zod schemas ensure no unexpected data leakage.
4. **Dependency pinning** — `pnpm-lock.yaml` ensures reproducible installs. `onlyBuiltDependencies` lists only packages that need build scripts.

### Review Checklist

- [ ] New endpoint has Zod validation
- [ ] No `any` types on response data
- [ ] No raw SQL strings (use Prisma)
- [ ] Rate limiting applied
- [ ] Auth middleware applied if user data accessed
- [ ] No console.log of sensitive data
- [ ] Cookie flags correct (httpOnly, secure, sameSite)
- [ ] CORS origin restricted in production

### Dependency Security

```yaml
# pnpm-workspace.yaml
onlyBuiltDependencies:
  - "@prisma/client"     # Native query engine
  - "@prisma/engines"    # Query engine binary
  - "prisma"             # CLI
  - "esbuild"            # Vite dependency
  - "bufferutil"         # WebSocket optimization
  - "utf-8-validate"     # WebSocket validation
```

Only 6 packages are allowed to run install scripts. All others are restricted, reducing the supply chain attack surface.

---

## Operational Security

### Railway Security

- **Secrets management**: All secrets stored in Railway's encrypted environment variable store. Never in `railway.json` or Dockerfiles.
- **Network isolation**: Railway services communicate over an internal network. The database is not exposed to the internet.
- **Health checks**: Public endpoints restricted to `/health`. No sensitive data returned.

### Vercel Security

- **Static-only**: No server-side execution. The frontend is pure static files served from CDN.
- **No secrets**: Vite environment variables (`VITE_*`) are compiled into the bundle at build time. No server secrets.
- **SPA routing**: All routes handled client-side. No backend interaction for page navigation.

### Incident Response

| Event | Detection | Response |
|-------|-----------|----------|
| Suspicious auth activity | Rate limit alerts | Block IP, investigate nonce patterns |
| Database breach | Prisma audit logs | Rotate all credentials, notify users |
| JWT compromise | Unknown trading activity | Increment `tokenVersion` for affected users |
| Dependency CVE | `pnpm audit` CI warning | Update dependency, rebuild, redeploy |

---

*For architecture details, see [ARCHITECTURE.md](../ARCHITECTURE.md). For deployment, see [DEPLOYMENT.md](./DEPLOYMENT.md).*
