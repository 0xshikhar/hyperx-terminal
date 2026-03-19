import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, MarketRoomRpc, AccountHubRpc, MarketTick } from "./types.js";
import { ClientHub } from "./dos/ClientHub.js";
import { MarketRoom } from "./dos/MarketRoom.js";
import { AccountHub } from "./dos/AccountHub.js";

// Export Durable Object classes for Cloudflare Workers runtime
export { ClientHub, MarketRoom, AccountHub };

const app = new Hono<{ Bindings: Env }>();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "x-hyperx-timestamp", "x-hyperx-ingest"],
  })
);

app.get("/health", (c) => {
  return c.json({ status: "ok", service: "hyperx-bff", timestamp: Date.now() });
});

/**
 * Upgrade client connections to the ClientHub Durable Object
 */
app.get("/ws", (c) => {
  const upgradeHeader = c.req.header("Upgrade");
  if (upgradeHeader !== "websocket") {
    return c.text("Expected Upgrade: websocket", 426);
  }

  // Route to client hub singleton or sharded hub
  const hubId = "hub:0";
  const hub = c.env.CLIENT_HUB.get(c.env.CLIENT_HUB.idFromName(hubId));
  return hub.fetch(c.req.raw);
});

/**
 * Verify Web Crypto HMAC SHA-256
 */
async function verifyHmacSignature(
  secret: string,
  timestamp: string,
  rawBody: string,
  signatureHeader: string
): Promise<boolean> {
  try {
    if (!signatureHeader.startsWith("sha256=")) return false;
    const hex = signatureHeader.slice(7);
    const sigBytes = new Uint8Array(hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []);

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const data = enc.encode(`${timestamp}.${rawBody}`);
    return await crypto.subtle.verify("HMAC", key, sigBytes, data);
  } catch {
    return false;
  }
}

/**
 * Ingest high-frequency delta batches from Fly.io Ingest daemon
 */
app.post("/internal/ticks", async (c) => {
  const timestamp = c.req.header("x-hyperx-timestamp");
  const signature = c.req.header("x-hyperx-ingest");

  if (!timestamp || !signature) {
    return c.json({ error: "missing_signature_headers" }, 401);
  }

  const age = Math.abs(Date.now() - parseInt(timestamp, 10));
  if (age > 60000) {
    return c.json({ error: "expired_timestamp" }, 401);
  }

  const rawBody = await c.req.text();
  const secret = c.env.INGEST_HMAC_SECRET || c.env.JWT_SECRET;
  const isValid = await verifyHmacSignature(secret, timestamp, rawBody, signature);

  if (!isValid) {
    return c.json({ error: "invalid_signature" }, 401);
  }

  let parsed: { ticks: MarketTick[] };
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  if (!Array.isArray(parsed.ticks) || parsed.ticks.length === 0) {
    return c.json({ ok: true, count: 0 });
  }

  // Group ticks by target MarketRoom DO key: `market:${network}:${market}`
  const groups = new Map<string, MarketTick[]>();
  for (const tick of parsed.ticks) {
    const key = `market:${tick.network}:${tick.market}`;
    let list = groups.get(key);
    if (!list) {
      list = [];
      groups.set(key, list);
    }
    list.push(tick);
  }

  // Fanout ticks into corresponding MarketRooms in parallel
  await Promise.all(
    Array.from(groups.entries()).map(async ([roomKey, ticks]) => {
      try {
        const room = c.env.MARKET_ROOM.get(c.env.MARKET_ROOM.idFromName(roomKey)) as unknown as MarketRoomRpc;
        await room.applyTicks(ticks);
      } catch (err) {
        console.warn(`[BFF] Failed routing ticks to ${roomKey}:`, (err as Error).message);
      }
    })
  );

  return c.json({ ok: true, count: parsed.ticks.length });
});

/**
 * Push Paradex Session JWT into user's AccountHub DO
 */
app.post("/api/dex/paradex/session/sync-hub", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const token = authHeader.slice(7);
  let userId: string;
  try {
    const parts = token.split(".");
    const payload = JSON.parse(atob(parts[1]));
    userId = payload.userId;
  } catch {
    return c.json({ error: "invalid_token" }, 401);
  }

  const { jwt, expiresAt } = await c.req.json<{ jwt: string; expiresAt: number }>();
  if (!jwt || !expiresAt) {
    return c.json({ error: "missing_jwt_or_expiresAt" }, 400);
  }

  const acct = c.env.ACCOUNT_HUB.get(c.env.ACCOUNT_HUB.idFromName(`account:${userId}`)) as unknown as AccountHubRpc;
  await acct.pushParadexJwt(jwt, expiresAt);

  return c.json({ ok: true, userId });
});

export default app;
