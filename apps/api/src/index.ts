import Fastify from "fastify";
import type { FastifyRequest, FastifyReply } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import { AlertCondition } from "@prisma/client";
import type { MetricPayload } from "@hyperx/types/api";
import { env } from "./config/env";
import { prisma } from "./db/client";
import { registerRateLimit } from "./middleware/rateLimit";
import { requireAuth, optionalAuth } from "./middleware/auth.js";
import { authRoutes } from "./routes/auth.js";
import { z } from "zod";
import { createNotification, formatNotifAmount } from "./services/notifications.service.js";
import {
  getOrderRouter,
  createExtendedClient,
  createParadexClient,
  ExtendedClient,
  ParadexClient,
} from "./dex/index.js";
import type { RouteRequest } from "@hyperx/types/dex";
import {
  fromParadexMarketSymbol,
  normalizeMarketSymbol,
  toParadexMarketSymbol,
} from "@hyperx/types/common";
import type { ParadexNetwork } from "@hyperx/types/common";

const PORT = Number(env.PORT ?? 3001);

const app = Fastify({
  logger: env.NODE_ENV !== "test",
});

// Register JWT plugin
await app.register(jwt, {
  secret: env.JWT_SECRET,
  cookie: {
    cookieName: "token",
    signed: false,
  },
});

// Register cookie plugin
await app.register(cookie, {
  secret: env.COOKIE_SECRET || env.JWT_SECRET,
  parseOptions: {},
});

const metricsBuffer: MetricPayload[] = [];
const MAX_METRICS = 200;

await app.register(cors, {
  origin: env.NODE_ENV === "production" ? process.env.CORS_ORIGIN?.split(",") ?? ["https://hyperx.app"] : true,
  credentials: true,
});
await app.register(helmet);
await registerRateLimit(app, { maxPerMinute: 120 });

// Auth routes (public)
await authRoutes(app);
await app.register(async (instance) => {
  await authRoutes(instance);
}, { prefix: "/api" });

async function dbHealthy(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

app.get("/health", async () => ({ ok: true, db: await dbHealthy() }));

app.get("/api/health", async () => ({ ok: true, db: await dbHealthy() }));

const metricsSchema = z.object({
  metrics: z.array(
    z.object({
      name: z.string(),
      value: z.number(),
      timestamp: z.number(),
      meta: z.record(z.unknown()).optional(),
    })
  ),
});

app.post("/api/metrics", async (req, reply) => {
  const parsed = metricsSchema.safeParse(req.body);
  if (!parsed.success) {
    reply.status(400);
    return { error: "invalid_metrics" };
  }

  metricsBuffer.push(...parsed.data.metrics);
  if (metricsBuffer.length > MAX_METRICS) {
    metricsBuffer.splice(0, metricsBuffer.length - MAX_METRICS);
  }
  return { accepted: parsed.data.metrics.length };
});

app.get("/api/metrics", async () => ({
  metrics: metricsBuffer.slice(-50),
}));

app.get("/api/markets", async (req) => {
  const network = getParadexNetwork(req);
  const marketClient = getParadexMarketClient(network);
  if (!marketClient) return { markets: [] };

  try {
    const markets = await marketClient.getMarkets();
    const mapped = markets.map((m) => ({
      symbol: fromParadexMarketSymbol((m as unknown as Record<string, unknown>).symbol as string ?? (m as unknown as Record<string, unknown>).market as string ?? ""),
      name: (m as unknown as Record<string, unknown>).name ?? (m as unknown as Record<string, unknown>).baseCurrency ?? "",
      lastPrice: Number((m as unknown as Record<string, unknown>).lastPrice ?? (m as unknown as Record<string, unknown>).indexPrice ?? 0),
      changePercent24h: Number((m as unknown as Record<string, unknown>).changePercent24h ?? (m as unknown as Record<string, unknown>).priceChangePercent24h ?? 0),
      volume24h: Number((m as unknown as Record<string, unknown>).volume24h ?? 0),
      openInterest: Number((m as unknown as Record<string, unknown>).openInterest ?? 0),
      fundingRate: Number((m as unknown as Record<string, unknown>).fundingRate ?? 0),
    }));
    return { markets: mapped };
  } catch (error) {
    console.error("Failed to fetch Paradex markets:", error);
    return { markets: [] };
  }
});

const candleIntervalSchema = z.enum(["1m", "5m", "15m", "1h", "4h", "1d"]);

const candleIntervalSeconds: Record<z.infer<typeof candleIntervalSchema>, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
};

const marketCandlesQuerySchema = z.object({
  interval: candleIntervalSchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

app.get("/api/markets/:market/candles", async (req, reply) => {
  const params = z.object({ market: z.string().min(1) }).safeParse(req.params);
  if (!params.success) {
    reply.status(400);
    return { error: "invalid_market" };
  }

  const query = marketCandlesQuerySchema.safeParse(req.query);
  if (!query.success) {
    reply.status(400);
    return { error: "invalid_candle_query" };
  }

  const interval = query.data.interval ?? "1m";
  const limit = query.data.limit ?? 120;
  const to = Math.floor(Date.now() / 1000);
  const from = to - candleIntervalSeconds[interval] * limit;

  const network = getParadexNetwork(req);
  const candleClient = getParadexClient(network) ?? getParadexMarketClient(network);
  if (!candleClient) {
    return {
      market: params.data.market,
      interval,
      candles: [],
      isReference: true,
    };
  }

  try {
    const market = toParadexMarketSymbol(normalizeMarketSymbol(params.data.market));
    const response = await candleClient.getCandles(market, interval, from, to);
    return {
      market: response.market,
      interval: response.resolution,
      candles: response.candles.map((candle) => ({
        time: candle.time,
        open: Number(candle.open),
        high: Number(candle.high),
        low: Number(candle.low),
        close: Number(candle.close),
      })),
    };
  } catch (error) {
    return {
      market: params.data.market,
      interval,
      candles: [],
      isReference: true,
    };
  }
});

// Network-aware Paradex client helpers
function getParadexNetwork(req: FastifyRequest): ParadexNetwork {
  const network = (req.headers as Record<string, string>)["x-paradex-network"];
  if (network === "mainnet") return "mainnet";
  return "testnet";
}

function getParadexClient(network: ParadexNetwork): ParadexClient | null {
  return paradexClients.get(network) ?? null;
}

function getParadexMarketClient(network: ParadexNetwork): ParadexClient | null {
  return paradexMarketClients.get(network) ?? null;
}

// Helper to get authenticated user from JWT
async function getAuthedUser(req: FastifyRequest, reply: FastifyReply) {
  try {
    const authenticated = await requireAuth(req, reply);
    if (!authenticated || !req.user) {
      return null;
    }

    return await prisma.user.findUnique({
      where: { id: (req.user as { userId: string }).userId },
      include: { preferences: true },
    });
  } catch {
    return null;
  }
}

app.get("/api/me", async (req, reply) => {
  const user = await getAuthedUser(req, reply);
  if (!user) return { error: "missing_wallet_address" };

  return {
    user: {
      id: user.id,
      walletAddress: user.walletAddress,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
      preferences: user.preferences
        ? {
          theme: user.preferences.theme,
          defaultLeverage: user.preferences.defaultLeverage,
          defaultMarket: user.preferences.defaultMarket,
          favoriteMarkets: user.preferences.favoriteMarkets,
        }
        : null,
    },
  };
});

function deriveAccountSummary(positions: Array<{ entryPrice: number; size: number; margin: number; pnl: number }>) {
  const marginUsed = positions.reduce((total, position) => total + position.margin, 0);
  const unrealizedPnl = positions.reduce((total, position) => total + position.pnl, 0);
  const notionalExposure = positions.reduce((total, position) => total + position.entryPrice * position.size, 0);
  const balance = notionalExposure;
  const available = Math.max(balance - marginUsed, 0);

  return {
    balance,
    available,
    marginUsed,
    unrealizedPnl,
  };
}

app.get("/api/account", async (req, reply) => {
  const user = await getAuthedUser(req, reply);
  if (!user) return { error: "missing_wallet_address" };

  const network = getParadexNetwork(req);
  const client = getParadexClient(network);

  let positions: Array<{ entryPrice: number; size: number; margin: number; pnl: number }> = [];
  if (client) {
    try {
      const raw = await client.getPositions();
      positions = raw
        .map((pos) => mapParadexPosition(pos as unknown as Record<string, unknown>))
        .sort((a, b) => b.openedAt.localeCompare(a.openedAt));
    } catch (error) {
      console.error("Failed to fetch Paradex positions:", error);
    }
  }

  return {
    account: deriveAccountSummary(positions),
  };
});

const preferencesSchema = z.object({
  theme: z.string().optional(),
  defaultLeverage: z.number().int().min(1).max(100).optional(),
  defaultMarket: z.string().optional(),
  favoriteMarkets: z.array(z.string()).optional(),
});

app.put("/api/preferences", async (req, reply) => {
  const user = await getAuthedUser(req, reply);
  if (!user) return { error: "missing_wallet_address" };

  const body = preferencesSchema.safeParse(req.body);
  if (!body.success) {
    reply.status(400);
    return { error: "invalid_preferences" };
  }

  const prefs = await prisma.userPreferences.upsert({
    where: { userId: user.id },
    update: body.data,
    create: {
      userId: user.id,
      theme: body.data.theme ?? "dark",
      defaultLeverage: body.data.defaultLeverage ?? 10,
      defaultMarket: body.data.defaultMarket ?? "BTC-USD",
      favoriteMarkets: body.data.favoriteMarkets ?? [],
    },
  });

  return {
    preferences: {
      theme: prefs.theme,
      defaultLeverage: prefs.defaultLeverage,
      defaultMarket: prefs.defaultMarket,
      favoriteMarkets: prefs.favoriteMarkets,
    },
  };
});

const alertCreateSchema = z.object({
  market: z.string().min(1),
  condition: z.nativeEnum(AlertCondition),
  targetPrice: z.string().min(1),
});

app.get("/api/alerts", async (req, reply) => {
  const user = await getAuthedUser(req, reply);
  if (!user) return { error: "missing_wallet_address" };

  const alerts = await prisma.priceAlert.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return {
    alerts: alerts.map((alert: any) => ({
      id: alert.id,
      market: alert.market,
      condition: alert.condition,
      targetPrice: alert.targetPrice.toString(),
      triggered: alert.triggered,
      triggeredAt: alert.triggeredAt ? alert.triggeredAt.toISOString() : null,
      createdAt: alert.createdAt.toISOString(),
    })),
  };
});

app.post("/api/alerts", async (req, reply) => {
  const user = await getAuthedUser(req, reply);
  if (!user) return { error: "missing_wallet_address" };

  const body = alertCreateSchema.safeParse(req.body);
  if (!body.success) {
    reply.status(400);
    return { error: "invalid_alert" };
  }

  const created = await prisma.priceAlert.create({
    data: {
      userId: user.id,
      market: body.data.market,
      condition: body.data.condition,
      targetPrice: body.data.targetPrice,
    },
  });

  try {
    await createNotification({
      userId: user.id,
      title: "Alert Created",
      message: `${body.data.market} ${body.data.condition === "ABOVE" ? ">" : "<"} $${formatNotifAmount(body.data.targetPrice)}`,
      type: "alert",
      amount: body.data.targetPrice,
    });
  } catch {}

  return {
    alert: {
      id: created.id,
      market: created.market,
      condition: created.condition,
      targetPrice: created.targetPrice.toString(),
      triggered: created.triggered,
      createdAt: created.createdAt.toISOString(),
    },
  };
});

app.delete("/api/alerts/:id", async (req, reply) => {
  const user = await getAuthedUser(req, reply);
  if (!user) return { error: "missing_wallet_address" };

  const idSchema = z.object({ id: z.string().min(1) });
  const params = idSchema.safeParse(req.params);
  if (!params.success) {
    reply.status(400);
    return { error: "invalid_alert_id" };
  }

  const deleted = await prisma.priceAlert.deleteMany({
    where: { id: params.data.id, userId: user.id },
  });

  return { deleted: deleted.count };
});

const notificationCreateSchema = z.object({
  title: z.string().min(1),
  message: z.string().optional(),
  type: z.string().min(1),
  amount: z.string().optional(),
});

app.get("/api/notifications", async (req, reply) => {
  const user = await getAuthedUser(req, reply);
  if (!user) return { error: "missing_wallet_address" };

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return {
    notifications: notifications.map((n: any) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      amount: n.amount,
      status: n.status,
      createdAt: n.createdAt.toISOString(),
    })),
  };
});

app.post("/api/notifications", async (req, reply) => {
  const user = await getAuthedUser(req, reply);
  if (!user) return { error: "missing_wallet_address" };

  const body = notificationCreateSchema.safeParse(req.body);
  if (!body.success) {
    reply.status(400);
    return { error: "invalid_notification" };
  }

  const created = await prisma.notification.create({
    data: {
      userId: user.id,
      title: body.data.title,
      message: body.data.message,
      type: body.data.type,
      amount: body.data.amount,
    },
  });

  return {
    notification: {
      id: created.id,
      title: created.title,
      message: created.message,
      type: created.type,
      amount: created.amount,
      status: created.status,
      createdAt: created.createdAt.toISOString(),
    },
  };
});

app.post("/api/notifications/:id/read", async (req, reply) => {
  const user = await getAuthedUser(req, reply);
  if (!user) return { error: "missing_wallet_address" };

  const idSchema = z.object({ id: z.string().min(1) });
  const params = idSchema.safeParse(req.params);
  if (!params.success) {
    reply.status(400);
    return { error: "invalid_notification_id" };
  }

  const updated = await prisma.notification.updateMany({
    where: { id: params.data.id, userId: user.id },
    data: { status: "read" },
  });

  return { updated: updated.count };
});

const orderSchema = z.object({
  market: z.string(),
  side: z.union([z.literal("buy"), z.literal("sell")]),
  type: z.union([z.literal("market"), z.literal("limit"), z.literal("stop")]),
  size: z.string(),
  price: z.string().optional(),
  stopPrice: z.string().optional(),
});

app.post("/api/orders", async (req, reply) => {
  const body = orderSchema.safeParse(req.body);
  if (!body.success) {
    reply.status(400);
    return { error: "invalid_order" };
  }

  const network = getParadexNetwork(req);
  const client = getParadexClient(network);

  if (!client) {
    reply.status(503);
    return { error: "order_failed", message: `Trading requires Paradex credentials for ${network}.` };
  }

  try {
    const paradexType =
      body.data.type === "stop"
        ? body.data.price
          ? "STOP_LIMIT"
          : "STOP_MARKET"
        : body.data.type === "limit"
          ? "LIMIT"
          : "MARKET";
    const order = await client.createOrder({
      market: toParadexMarketSymbol(body.data.market),
      side: body.data.side === "buy" ? "BUY" : "SELL",
      type: paradexType,
      size: body.data.size,
      price: body.data.price,
      stopPrice: body.data.stopPrice,
      timeInForce: "GTC",
    });
    const id = (order as { id?: string }).id ?? `${body.data.market}-${Date.now()}`;
    try {
      const user = await getAuthedUser(req, reply);
      if (user) {
        await createNotification({
          userId: user.id,
          title: "Order Placed",
          message: `${body.data.side.toUpperCase()} ${formatNotifAmount(body.data.size)} ${body.data.market} @ ${body.data.price ? "$" + formatNotifAmount(body.data.price) : "Market"}`,
          type: "order",
          amount: body.data.size,
        });
      }
    } catch {}
    return { id };
  } catch (error) {
    reply.status(500);
    return { error: "order_failed", message: (error as Error).message };
  }
});

app.delete("/api/orders/:id", async (req, reply) => {
  const idSchema = z.object({ id: z.string().min(1) });
  const params = idSchema.safeParse(req.params);
  if (!params.success) {
    reply.status(400);
    return { error: "invalid_order_id" };
  }

  const network = getParadexNetwork(req);
  const client = getParadexClient(network);

  if (client) {
    try {
      await client.cancelOrder(params.data.id);
      return { success: true };
    } catch (error) {
      reply.status(500);
      return { error: "cancel_failed", message: (error as Error).message };
    }
  }

  return { success: true };
});

app.delete("/api/orders", async (req, reply) => {
  const market = (req.query as { market?: string }).market;
  const network = getParadexNetwork(req);
  const client = getParadexClient(network);

  if (client) {
    try {
      const result = await client.cancelAllOrders(
        market ? toParadexMarketSymbol(market) : undefined
      );
      return result;
    } catch (error) {
      reply.status(500);
      return { error: "cancel_all_failed", message: (error as Error).message };
    }
  }

  return { canceled: 0 };
});

const PAGE_SIZE = 20;

function normalizeDexMarket<T extends object>(exchange: string, market: T) {
  const marketData = market as Record<string, unknown>;
  const symbolSource =
    (marketData.market as string | undefined) ??
    (marketData.symbol as string | undefined) ??
    (marketData.baseCurrency as string | undefined) ??
    (marketData.base_currency as string | undefined) ??
    "";
  const quoteSource =
    (marketData.quoteCurrency as string | undefined) ??
    (marketData.quote_currency as string | undefined) ??
    "";
  const rawSymbol =
    symbolSource && quoteSource ? `${symbolSource}-${quoteSource}` : symbolSource;
  const canonicalSymbol =
    exchange.toLowerCase() === "paradex"
      ? fromParadexMarketSymbol(rawSymbol)
      : normalizeMarketSymbol(rawSymbol);

  return {
    ...marketData,
    symbol: canonicalSymbol,
    market: canonicalSymbol,
  };
}

function pickValue<T extends Record<string, unknown>>(
  source: T,
  keys: string[]
): unknown {
  for (const key of keys) {
    if (key in source && source[key] != null) {
      return source[key];
    }
  }
  return undefined;
}

function pickString<T extends Record<string, unknown>>(
  source: T,
  keys: string[],
  fallback = ""
): string {
  const value = pickValue(source, keys);
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

function pickNumber<T extends Record<string, unknown>>(
  source: T,
  keys: string[],
  fallback = 0
): number {
  const value = pickValue(source, keys);
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function toIsoTimestamp(value: unknown): string {
  if (typeof value === "number") {
    return new Date(value).toISOString();
  }
  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && value.trim() !== "") {
      return new Date(numeric).toISOString();
    }
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

function mapParadexPosition(raw: Record<string, unknown>) {
  const marketRaw = pickString(raw, ["market", "symbol"]);
  const market = fromParadexMarketSymbol(marketRaw);
  const sideRaw = pickString(raw, ["side", "position_side"]);
  const side = sideRaw.toUpperCase() === "SHORT" ? "short" : "long";
  const sizeRaw = pickNumber(raw, ["size", "position_size", "positionSize"], 0);
  const size = Math.abs(sizeRaw);
  const entryPrice = pickNumber(raw, [
    "entry_price",
    "entryPrice",
    "average_entry_price",
    "avg_entry_price",
    "average_entry_price_usd",
  ]);
  const leverage = Math.max(
    pickNumber(raw, ["leverage", "position_leverage", "leverage_ratio"], 1),
    1
  );
  const margin =
    pickNumber(raw, ["margin", "initial_margin", "position_margin", "cost"], 0) ||
    (entryPrice && size ? (entryPrice * size) / leverage : 0);
  const unrealizedPnl = pickNumber(raw, [
    "unrealized_pnl",
    "unrealizedPnl",
    "pnl",
    "unrealized_pnl_usd",
  ]);
  let markPrice = pickNumber(raw, ["mark_price", "markPrice"], 0);
  if (!markPrice && entryPrice && size) {
    const direction = side === "long" ? 1 : -1;
    markPrice = entryPrice + (unrealizedPnl / size / direction);
  }
  if (!markPrice) markPrice = entryPrice || 0;

  const openedAt = toIsoTimestamp(
    pickValue(raw, ["created_at", "opened_at", "openedAt", "updated_at"])
  );
  const id = pickString(
    raw,
    ["id", "position_id", "positionId"],
    `${market}-${side}-${openedAt}`
  );
  const direction = side === "long" ? 1 : -1;
  const pnl = (markPrice - entryPrice) * size * direction;
  const pnlPercent = margin ? (pnl / margin) * 100 : 0;

  return {
    id,
    market,
    side,
    size,
    entryPrice,
    markPrice,
    leverage,
    margin,
    openedAt,
    pnl,
    pnlPercent,
  };
}

function normalizeOrderStatus(statusRaw: string) {
  const status = statusRaw.toUpperCase();
  if (["OPEN", "NEW", "PENDING"].includes(status)) return "open";
  if (["PARTIAL", "PARTIALLY_FILLED"].includes(status)) return "partial";
  if (["FILLED", "CLOSED"].includes(status)) return "filled";
  if (["CANCELED", "CANCELLED", "REJECTED"].includes(status)) return "canceled";
  return "open";
}

function mapParadexOrder(raw: Record<string, unknown>) {
  const marketRaw = pickString(raw, ["market", "symbol"]);
  const market = fromParadexMarketSymbol(marketRaw);
  const sideRaw = pickString(raw, ["side"]);
  const side = sideRaw.toUpperCase() === "SELL" ? "sell" : "buy";
  const typeRaw = pickString(raw, ["type"]);
  const typeUpper = typeRaw.toUpperCase();
  const type =
    typeUpper.startsWith("STOP") ? "stop" : typeUpper === "MARKET" ? "market" : "limit";
  const price = pickNumber(raw, ["price", "trigger_price", "triggerPrice"], 0);
  const size = pickNumber(raw, ["size", "remaining_size", "remainingSize"], 0);
  const status = normalizeOrderStatus(pickString(raw, ["status"], "OPEN"));
  const id = pickString(raw, ["id", "order_id", "orderId"], `${market}-${Date.now()}`);
  return { id, market, side, type, price, size, status };
}

function mapParadexTrade(raw: Record<string, unknown>) {
  const marketRaw = pickString(raw, ["market", "symbol"]);
  const market = fromParadexMarketSymbol(marketRaw);
  const sideRaw = pickString(raw, ["side"]);
  const side = sideRaw.toUpperCase() === "SELL" ? "sell" : "buy";
  const size = pickNumber(raw, ["size", "quantity", "qty"], 0);
  const price = pickNumber(raw, ["price"], 0);
  const fee = pickNumber(raw, ["fee", "commission"], 0);
  const pnl = pickNumber(raw, ["pnl"], 0);
  const executedAt = toIsoTimestamp(
    pickValue(raw, ["timestamp", "time", "executed_at", "executedAt"])
  );
  const id = pickString(raw, ["id", "trade_id", "tradeId"], `${market}-${Date.now()}`);
  return { id, market, side, size, price, fee, pnl, executedAt };
}

function mapParadexFunding(raw: Record<string, unknown>) {
  const marketRaw = pickString(raw, ["market", "symbol"]);
  const market = fromParadexMarketSymbol(marketRaw);
  const rate = pickNumber(raw, ["fundingRate", "funding_rate", "rate"], 0);
  const payment = pickNumber(raw, ["payment", "fundingPayment", "funding_payment"], 0);
  const time = toIsoTimestamp(pickValue(raw, ["time", "timestamp", "paid_at", "paidAt"]));
  const id = pickString(raw, ["id"], `${market}-${time}`);
  return { id, market, rate, payment, time };
}

app.get("/api/positions", async (req, reply) => {
  const network = getParadexNetwork(req);
  const client = getParadexClient(network);

  let positions: ReturnType<typeof mapParadexPosition>[] = [];
  if (client) {
    try {
      const raw = await client.getPositions();
      positions = raw
        .map((pos) => mapParadexPosition(pos as unknown as Record<string, unknown>))
        .sort((a, b) => b.openedAt.localeCompare(a.openedAt));
    } catch (error) {
      console.error("Failed to fetch Paradex positions:", error);
    }
  }

  return { positions };
});

app.get("/api/orders", async (req, reply) => {
  const market = (req.query as { market?: string }).market;
  const network = getParadexNetwork(req);
  const client = getParadexClient(network);

  if (client) {
    try {
      const raw = await client.getOpenOrders(
        market ? toParadexMarketSymbol(market) : undefined
      );
      const orders = raw.map((order) =>
        mapParadexOrder(order as unknown as Record<string, unknown>)
      );
      return { orders };
    } catch (error) {
      console.error("Failed to fetch Paradex orders:", error);
    }
  }

  return { orders: [] };
});

app.get("/api/trades", async (req, reply) => {
  const query = req.query as { page?: string; market?: string };
  const page = Number(query.page) || 1;
  const market = query.market;
  const network = getParadexNetwork(req);
  const client = getParadexClient(network);

  if (client) {
    try {
      const paradexMarket = toParadexMarketSymbol(market || "BTC-USD");
      const tradesResponse = await client.getTrades(
        paradexMarket,
        PAGE_SIZE
      );
      const items = tradesResponse.trades.map((trade) =>
        mapParadexTrade(trade as unknown as Record<string, unknown>)
      );
      return { items, total: items.length };
    } catch (error) {
      console.error("Failed to fetch Paradex trades:", error);
    }
  }

  return { items: [], total: 0 };
});

app.get("/api/funding", async (req, reply) => {
  const query = req.query as { page?: string; market?: string };
  const page = Number(query.page) || 1;
  const market = query.market;
  const network = getParadexNetwork(req);
  const client = getParadexClient(network);

  if (client) {
    try {
      const paradexMarket = market ? toParadexMarketSymbol(market) : undefined;
      const fundingResponse = await client.getFundingPayments(
        paradexMarket,
        PAGE_SIZE
      );
      const items = fundingResponse.payments.map((payment) =>
        mapParadexFunding(payment as unknown as Record<string, unknown>)
      );
      return { items, total: items.length };
    } catch (error) {
      console.error("Failed to fetch Paradex funding:", error);
    }
  }

  return { items: [], total: 0 };
});

// DEX Integration Routes

const orderRouter = getOrderRouter();
const dexClients = new Map<string, ExtendedClient | ParadexClient>();
let extendedClient: ExtendedClient | null = null;
const paradexClients = new Map<ParadexNetwork, ParadexClient | null>();
const paradexMarketClients = new Map<ParadexNetwork, ParadexClient | null>();

function resolveParadexUrl(network: ParadexNetwork): string {
  if (network === "mainnet") {
    return env.PARADEX_MAINNET_API_URL || env.PARADEX_REST_URL || "https://api.prod.paradex.trade";
  }
  return env.PARADEX_API_URL || env.PARADEX_REST_URL || "https://api.testnet.paradex.trade";
}

const hasParadexAuth = Boolean(
  env.PARADEX_JWT_TOKEN ||
  (env.PARADEX_STARKNET_ADDRESS && env.PARADEX_STARKNET_PRIVATE_KEY)
);

const paradexNetworks: ParadexNetwork[] = ["testnet", "mainnet"];

for (const network of paradexNetworks) {
  const baseUrl = resolveParadexUrl(network);
  const isTestnet = network === "testnet";

  // Unauthenticated market client (always created)
  const marketClient = createParadexClient({
    name: `paradex-market-${network}`,
    baseUrl,
    chainId: Number(env.PARADEX_CHAIN_ID ?? ""),
    network: isTestnet ? "sepolia" : "mainnet",
  });
  paradexMarketClients.set(network, marketClient);

  // Authenticated client (only if credentials exist)
  if (hasParadexAuth) {
    const client = createParadexClient({
      name: `paradex-${network}`,
      baseUrl,
      chainId: Number(env.PARADEX_CHAIN_ID ?? ""),
      network: isTestnet ? "sepolia" : "mainnet",
      credentials: {
        starknetAddress: env.PARADEX_STARKNET_ADDRESS,
        starknetPrivateKey: env.PARADEX_STARKNET_PRIVATE_KEY,
        jwtToken: env.PARADEX_JWT_TOKEN,
      },
    });
    paradexClients.set(network, client);
    orderRouter.registerExchange(`paradex-${network}`, client);
    dexClients.set(`paradex-${network}`, client);
  } else {
    paradexClients.set(network, null);
  }
}

if (env.EXTENDED_API_KEY && env.EXTENDED_API_SECRET) {
  extendedClient = createExtendedClient({
    name: "extended",
    baseUrl: env.EXTENDED_API_URL || "https://api.extended.exchange",
    chainId: Number(env.EXTENDED_CHAIN_ID) || 1,
    network: "mainnet",
    credentials: {
      apiKey: env.EXTENDED_API_KEY,
      apiSecret: env.EXTENDED_API_SECRET,
    },
  });
  orderRouter.registerExchange("extended", extendedClient);
  dexClients.set("extended", extendedClient);
}

// DEX Market routes
app.get("/api/dex/markets", async (req) => {
  const exchanges = orderRouter.getExchanges();
  const allMarkets = [];

  for (const exchangeName of exchanges) {
    try {
      const client = dexClients.get(exchangeName);
      if (client instanceof ParadexClient) {
        const markets = await client.getMarkets();
        allMarkets.push({
          exchange: exchangeName,
          markets: markets.map((market) => normalizeDexMarket(exchangeName, market)),
        });
        continue;
      }
      if (client instanceof ExtendedClient) {
        const markets = await client.getMarkets();
        allMarkets.push({
          exchange: exchangeName,
          markets: markets.map((market) => normalizeDexMarket(exchangeName, market)),
        });
        continue;
      }
      allMarkets.push({
        exchange: exchangeName,
        markets: [],
      });
    } catch (error) {
      console.error(`Failed to fetch markets from ${exchangeName}:`, error);
    }
  }

  // Also include market clients for networks not in the exchange registry
  for (const [network, marketClient] of paradexMarketClients.entries()) {
    const exchangeName = `paradex-${network}`;
    if (!exchanges.includes(exchangeName) && marketClient) {
      try {
        const markets = await marketClient.getMarkets();
        allMarkets.push({
          exchange: exchangeName,
          markets: markets.map((market) => normalizeDexMarket(exchangeName, market)),
        });
      } catch (error) {
        console.error(`Failed to fetch public Paradex markets for ${network}:`, error);
      }
    }
  }

  return { exchanges, markets: allMarkets };
});

app.get("/api/dex/paradex/account", async (req, reply) => {
  const network = getParadexNetwork(req);
  const client = getParadexClient(network);
  if (!client) {
    reply.status(400);
    return { error: "paradex_not_configured" };
  }

  try {
    const account = await client.getAccount();
    return { account };
  } catch (error) {
    reply.status(500);
    return { error: "paradex_account_failed", message: (error as Error).message };
  }
});

app.get("/api/dex/paradex/balances", async (req, reply) => {
  const network = getParadexNetwork(req);
  const client = getParadexClient(network);
  if (!client) {
    reply.status(400);
    return { error: "paradex_not_configured" };
  }

  try {
    const balances = await client.getBalances();
    return { balances };
  } catch (error) {
    reply.status(500);
    return { error: "paradex_balances_failed", message: (error as Error).message };
  }
});

// DEX Order routes
const dexOrderSchema = z.object({
  market: z.string(),
  side: z.enum(["buy", "sell"]),
  type: z.enum(["market", "limit", "stop", "stop_limit"]),
  size: z.number().positive(),
  price: z.number().optional(),
  preferredExchange: z.string().optional(),
});

app.post("/api/dex/orders/route", async (req, reply) => {
  const user = await getAuthedUser(req, reply);
  if (!user) return { error: "missing_wallet_address" };

  const body = dexOrderSchema.safeParse(req.body);
  if (!body.success) {
    reply.status(400);
    return { error: "invalid_order" };
  }

  try {
    const routeRequest: RouteRequest = {
      market: body.data.market,
      side: body.data.side,
      type: body.data.type,
      size: body.data.size,
      price: body.data.price,
      preferredExchange: body.data.preferredExchange,
      allowSplit: true,
    };

    const route = await orderRouter.getRouteDecision(routeRequest);
    return { route };
  } catch (error) {
    reply.status(500);
    return { error: "routing_failed", message: (error as Error).message };
  }
});

app.get("/api/dex/health", async () => {
  const health = await orderRouter.healthCheck();
  return { exchanges: health };
});

await app.listen({ port: PORT, host: "0.0.0.0" });
