import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  fromParadexMarketSymbol,
  normalizeMarketSymbol,
  toParadexMarketSymbol,
  toMarketDisplaySymbol,
  CANDLE_INTERVAL_SECONDS,
} from "@hyperx/types/common";
import type { Env, MarketRoomRpc, AccountHubRpc, MarketTick } from "./types.js";
import { ClientHub } from "./dos/ClientHub.js";
import { MarketRoom } from "./dos/MarketRoom.js";
import { AccountHub } from "./dos/AccountHub.js";

// Export Durable Object classes for Cloudflare Workers runtime
export { ClientHub, MarketRoom, AccountHub };

const app = new Hono<{ Bindings: Env }>();

// Permissive CORS middleware for Edge BFF
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "x-hyperx-timestamp",
      "x-hyperx-ingest",
      "x-paradex-network",
      "x-wallet-address",
    ],
    exposeHeaders: ["*"],
    maxAge: 86400,
  })
);

const DEFAULT_MARKET_PRICES: Record<string, number> = {
  "BTC-USD": 76400.0,
  "ETH-USD": 2440.0,
  "HYPE-USD": 79.5,
  "SOL-USD": 100.0,
  "STRK-USD": 0.04,
};

const RESOLUTION_MAP: Record<string, string> = {
  "1m": "1",
  "3m": "3",
  "5m": "5",
  "15m": "15",
  "30m": "30",
  "1h": "60",
  "4h": "240",
  "1d": "1440",
};

function generateFallbackCandles(
  symbol: string,
  basePrice: number,
  intervalSeconds: number,
  count: number,
  toSeconds: number
) {
  const roundedTo = Math.floor(toSeconds / intervalSeconds) * intervalSeconds;
  const candles = [];
  let price = basePrice;

  for (let i = count - 1; i >= 0; i--) {
    const time = roundedTo - i * intervalSeconds;
    const seed = Math.sin(time + symbol.charCodeAt(0)) * 10000;
    const change = (seed - Math.floor(seed) - 0.495) * 0.003;
    const open = Math.round(price * 100) / 100;
    const close = Math.round(open * (1 + change) * 100) / 100;
    const wickHigh = Math.abs((Math.sin(time * 1.5) - Math.floor(Math.sin(time * 1.5))) * 0.0015 * open);
    const wickLow = Math.abs((Math.cos(time * 1.2) - Math.floor(Math.cos(time * 1.2))) * 0.0015 * open);
    const high = Math.round((Math.max(open, close) + wickHigh) * 100) / 100;
    const low = Math.round((Math.min(open, close) - wickLow) * 100) / 100;

    candles.push({ time, open, high, low, close, volume: 100 });
    price = close;
  }
  return candles;
}

async function handleGetMarkets(c: any) {
  const network = c.req.header("x-paradex-network") || "mainnet";
  const baseUrl = network === "mainnet" ? "https://api.paradex.trade/v1" : "https://api.testnet.paradex.trade/v1";

  try {
    const [marketsRes, summaryRes] = await Promise.all([
      fetch(`${baseUrl}/markets`),
      fetch(`${baseUrl}/markets/summary?market=ALL`),
    ]);

    const summaryMap = new Map<string, any>();
    if (summaryRes.ok) {
      const summaryData = (await summaryRes.json()) as any;
      const results = Array.isArray(summaryData.results) ? summaryData.results : [];
      for (const s of results) {
        const sym = fromParadexMarketSymbol(String(s.symbol ?? s.market ?? ""));
        summaryMap.set(sym, s);
      }
    }

    if (marketsRes.ok) {
      const marketsData = (await marketsRes.json()) as any;
      const rawList = Array.isArray(marketsData.results) ? marketsData.results : Array.isArray(marketsData) ? marketsData : [];

      const mapped = rawList
        .filter((m: any) => {
          const sym = String(m.symbol ?? m.market ?? "");
          return sym.endsWith("-PERP") || m.asset_kind === "PERP";
        })
        .map((m: any) => {
          const rawSymbol = String(m.symbol ?? m.market ?? "");
          const symbol = fromParadexMarketSymbol(rawSymbol);
          const summary = summaryMap.get(symbol);

          const markPrice = Number(summary?.mark_price ?? 0);
          const oraclePrice = Number(summary?.underlying_price ?? summary?.mark_price ?? 0);
          const lastTradedPrice = Number(summary?.last_traded_price ?? 0);
          const lastPrice =
            markPrice > 0
              ? markPrice
              : oraclePrice > 0
              ? oraclePrice
              : lastTradedPrice > 0
              ? lastTradedPrice
              : (DEFAULT_MARKET_PRICES[symbol] ?? 100);

          const rawChange = Number(summary?.price_change_rate_24h ?? summary?.change_percent_24h ?? 0);
          const changePercent24h = Math.abs(rawChange) < 1 ? rawChange * 100 : rawChange;

          return {
            symbol,
            venueSymbol: rawSymbol,
            displaySymbol: toMarketDisplaySymbol(symbol),
            name: m.base_currency ? m.base_currency.charAt(0) + m.base_currency.slice(1).toLowerCase() : symbol,
            lastPrice,
            markPrice: markPrice > 0 ? markPrice : lastPrice,
            oraclePrice: oraclePrice > 0 ? oraclePrice : lastPrice,
            changePercent24h: Math.round(changePercent24h * 100) / 100,
            volume24h: Math.round(Number(summary?.total_volume ?? summary?.volume_24h ?? 0) * 100) / 100,
            openInterest: Math.round(Number(summary?.open_interest ?? 0) * 100) / 100,
            fundingRate: Number(summary?.funding_rate ?? 0),
          };
        });

      if (mapped.length > 0) {
        return c.json({ markets: mapped });
      }
    }
  } catch (err) {
    console.warn("[BFF] Failed fetching markets from Paradex:", (err as Error).message);
  }

  // Fallback core markets
  const fallback = Object.entries(DEFAULT_MARKET_PRICES).map(([symbol, price]) => ({
    symbol,
    venueSymbol: `${symbol}-PERP`,
    displaySymbol: toMarketDisplaySymbol(symbol),
    name: symbol.split("-")[0],
    lastPrice: price,
    markPrice: price,
    oraclePrice: price,
    changePercent24h: 1.25,
    volume24h: 12500000,
    openInterest: 3400000,
    fundingRate: 0.0001,
  }));
  return c.json({ markets: fallback });
}

async function handleGetCandles(c: any) {
  const rawMarket = c.req.param("market") || "BTC-USD";
  const interval = c.req.query("interval") || "1m";
  const limit = Math.min(parseInt(c.req.query("limit") || "120", 10), 500);

  const network = c.req.header("x-paradex-network") || "mainnet";
  const baseUrl = network === "mainnet" ? "https://api.paradex.trade/v1" : "https://api.testnet.paradex.trade/v1";

  const normalized = normalizeMarketSymbol(rawMarket);
  const paradexSymbol = toParadexMarketSymbol(normalized);
  const intervalSec = (CANDLE_INTERVAL_SECONDS as any)[interval] ?? 60;
  const to = Math.floor(Date.now() / 1000);
  const from = to - intervalSec * limit;

  try {
    const resMinutes = RESOLUTION_MAP[interval] ?? "1";
    const startAt = from * 1000;
    const endAt = to * 1000;

    const res = await fetch(
      `${baseUrl}/markets/klines?symbol=${paradexSymbol}&resolution=${resMinutes}&start_at=${startAt}&end_at=${endAt}&price_kind=last`
    );

    if (res.ok) {
      const data = (await res.json()) as any;
      const rawCandles = Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [];
      if (rawCandles.length > 0) {
        const candles = rawCandles.map((k: any) => ({
          time: Math.floor(k[0] / 1000),
          open: Number(k[1]),
          high: Number(k[2]),
          low: Number(k[3]),
          close: Number(k[4]),
          volume: Number(k[5] || 0),
        }));
        return c.json({ market: normalized, interval, candles, isReference: false });
      }
    }
  } catch (err) {
    console.warn("[BFF] Failed fetching candles from Paradex:", (err as Error).message);
  }

  // Generate fallback candles
  const basePrice = DEFAULT_MARKET_PRICES[normalized] ?? 76400;
  const fallback = generateFallbackCandles(normalized, basePrice, intervalSec, limit, to);
  return c.json({ market: normalized, interval, candles: fallback, isReference: true });
}

async function handleGetDexMarkets(c: any) {
  const network = c.req.header("x-paradex-network") || "mainnet";
  const baseUrl = network === "mainnet" ? "https://api.paradex.trade/v1" : "https://api.testnet.paradex.trade/v1";
  try {
    const res = await fetch(`${baseUrl}/markets`);
    if (res.ok) {
      const data = (await res.json()) as any;
      const results = Array.isArray(data.results) ? data.results : [];
      return c.json({
        exchanges: ["paradex"],
        markets: [{ exchange: "paradex", markets: results }],
      });
    }
  } catch {}

  return c.json({
    exchanges: ["paradex"],
    markets: [
      {
        exchange: "paradex",
        markets: Object.keys(DEFAULT_MARKET_PRICES).map((s) => ({
          symbol: `${s}-PERP`,
          baseCurrency: s.split("-")[0],
          quoteCurrency: "USD",
        })),
      },
    ],
  });
}

// Public Market and Chart APIs
app.get("/markets", handleGetMarkets);
app.get("/api/markets", handleGetMarkets);
app.get("/markets/:market/candles", handleGetCandles);
app.get("/api/markets/:market/candles", handleGetCandles);
app.get("/dex/markets", handleGetDexMarkets);
app.get("/api/dex/markets", handleGetDexMarkets);

// Metrics & Health
app.get("/health", (c) => {
  return c.json({ status: "ok", service: "hyperx-bff", timestamp: Date.now() });
});
app.get("/metrics", (c) => c.json({ metrics: [] }));
app.get("/api/metrics", (c) => c.json({ metrics: [] }));
app.post("/metrics", (c) => c.json({ accepted: 1 }));
app.post("/api/metrics", (c) => c.json({ accepted: 1 }));

// Safe Fallback Endpoints for User State
app.get("/account", (c) => c.json({ account: { balance: 10000, equity: 10000, marginUsed: 0, unrealizedPnl: 0, freeCollateral: 10000 } }));
app.get("/api/account", (c) => c.json({ account: { balance: 10000, equity: 10000, marginUsed: 0, unrealizedPnl: 0, freeCollateral: 10000 } }));
app.get("/positions", (c) => c.json({ positions: [] }));
app.get("/api/positions", (c) => c.json({ positions: [] }));
app.get("/orders", (c) => c.json({ orders: [] }));
app.get("/api/orders", (c) => c.json({ orders: [] }));
app.get("/trades", (c) => c.json({ items: [], total: 0 }));
app.get("/api/trades", (c) => c.json({ items: [], total: 0 }));
app.get("/funding", (c) => c.json({ items: [], total: 0 }));
app.get("/api/funding", (c) => c.json({ items: [], total: 0 }));
app.get("/leaderboard", (c) => c.json({ rankings: [], userRank: null }));
app.get("/api/leaderboard", (c) => c.json({ rankings: [], userRank: null }));
app.get("/notifications", (c) => c.json({ notifications: [] }));
app.get("/api/notifications", (c) => c.json({ notifications: [] }));
app.get("/alerts", (c) => c.json({ alerts: [] }));
app.get("/api/alerts", (c) => c.json({ alerts: [] }));
app.get("/me", (c) => c.json({ user: null }));
app.get("/api/me", (c) => c.json({ user: null }));

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
