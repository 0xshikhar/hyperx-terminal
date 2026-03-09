import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import { AlertCondition } from "@prisma/client";
import { env } from "./config/env";
import { prisma } from "./db/client";
import { registerRateLimit } from "./middleware/rateLimit";
import { requireAuth } from "./middleware/auth.js";
import { authRoutes } from "./routes/auth.js";
import { z } from "zod";
import { getOrderRouter, createExtendedClient, createParadexClient, ExtendedClient, ParadexClient, } from "./dex/index.js";
const PORT = Number(env.PORT ?? 3001);
const app = Fastify({
    logger: false,
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
const metricsBuffer = [];
const MAX_METRICS = 200;
await app.register(cors, {
    origin: true,
    credentials: true,
});
await app.register(helmet);
await registerRateLimit(app, { maxPerMinute: 120 });
// Auth routes (public)
await authRoutes(app);
await app.register(async (instance) => {
    await authRoutes(instance);
}, { prefix: "/api" });
app.get("/health", async () => ({ ok: true }));
app.get("/api/health", async () => ({ ok: true }));
const metricsSchema = z.object({
    metrics: z.array(z.object({
        name: z.string(),
        value: z.number(),
        timestamp: z.number(),
        meta: z.record(z.unknown()).optional(),
    })),
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
const markets = [
    {
        symbol: "BTC-USD",
        name: "Bitcoin",
        lastPrice: 95432.25,
        changePercent24h: 2.14,
        volume24h: 1284500000,
        openInterest: 482000000,
        fundingRate: 0.0125,
    },
    {
        symbol: "ETH-USD",
        name: "Ethereum",
        lastPrice: 4871.1,
        changePercent24h: -1.02,
        volume24h: 842000000,
        openInterest: 246000000,
        fundingRate: 0.0091,
    },
    {
        symbol: "STRK-USD",
        name: "StarkNet",
        lastPrice: 2.41,
        changePercent24h: 5.42,
        volume24h: 112000000,
        openInterest: 42000000,
        fundingRate: 0.021,
    },
];
app.get("/api/markets", async () => ({ markets }));
// Helper to get authenticated user from JWT
async function getAuthedUser(req, reply) {
    try {
        await requireAuth(req, reply);
        return req.user ? await prisma.user.findUnique({
            where: { id: req.user.userId },
            include: { preferences: true },
        }) : null;
    }
    catch {
        return null;
    }
}
app.get("/api/me", async (req, reply) => {
    const user = await getAuthedUser(req, reply);
    if (!user)
        return { error: "missing_wallet_address" };
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
const preferencesSchema = z.object({
    theme: z.string().optional(),
    defaultLeverage: z.number().int().min(1).max(100).optional(),
    defaultMarket: z.string().optional(),
    favoriteMarkets: z.array(z.string()).optional(),
});
app.put("/api/preferences", async (req, reply) => {
    const user = await getAuthedUser(req, reply);
    if (!user)
        return { error: "missing_wallet_address" };
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
    if (!user)
        return { error: "missing_wallet_address" };
    const alerts = await prisma.priceAlert.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 100,
    });
    return {
        alerts: alerts.map((alert) => ({
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
    if (!user)
        return { error: "missing_wallet_address" };
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
    if (!user)
        return { error: "missing_wallet_address" };
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
    if (!user)
        return { error: "missing_wallet_address" };
    const notifications = await prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
    });
    return {
        notifications: notifications.map((n) => ({
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
    if (!user)
        return { error: "missing_wallet_address" };
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
    if (!user)
        return { error: "missing_wallet_address" };
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
    if (paradexClient) {
        try {
            const paradexType = body.data.type === "stop"
                ? body.data.price
                    ? "STOP_LIMIT"
                    : "STOP_MARKET"
                : body.data.type === "limit"
                    ? "LIMIT"
                    : "MARKET";
            const order = await paradexClient.createOrder({
                market: toParadexMarket(body.data.market),
                side: body.data.side === "buy" ? "BUY" : "SELL",
                type: paradexType,
                size: body.data.size,
                price: body.data.price,
                stopPrice: body.data.stopPrice,
                timeInForce: "GTC",
            });
            const id = order.id ?? `${body.data.market}-${Date.now()}`;
            return { id };
        }
        catch (error) {
            reply.status(500);
            return { error: "order_failed", message: error.message };
        }
    }
    const id = `${body.data.market}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    return { id };
});
const PAGE_SIZE = 20;
const seedPositions = [
    { id: "pos-btc-1", market: "BTC-USD", side: "long", size: 0.25, entryPrice: 94200, markPrice: 95410, leverage: 8, margin: 2943.75, openedAt: "2026-03-08T00:20:00Z" },
    { id: "pos-eth-1", market: "ETH-USD", side: "short", size: 3.1, entryPrice: 4810, markPrice: 4762, leverage: 6, margin: 2488.35, openedAt: "2026-03-08T00:10:00Z" },
    { id: "pos-strk-1", market: "STRK-USD", side: "long", size: 1200, entryPrice: 2.12, markPrice: 2.34, leverage: 4, margin: 636, openedAt: "2026-03-07T23:40:00Z" },
];
const seedOrders = [
    { id: "ord-1", market: "BTC-USD", side: "buy", type: "limit", price: 94500, size: 0.1, status: "open" },
    { id: "ord-2", market: "ETH-USD", side: "sell", type: "stop", price: 4700, size: 1.5, status: "open" },
];
const seedTrades = [
    { id: "t-1", market: "BTC-USD", side: "buy", size: 0.05, price: 95120, fee: 2.38, pnl: 0, executedAt: "2026-03-08T00:15:00Z" },
    { id: "t-2", market: "ETH-USD", side: "sell", size: 2.0, price: 4795, fee: 4.79, pnl: -30, executedAt: "2026-03-08T00:10:00Z" },
    { id: "t-3", market: "BTC-USD", side: "buy", size: 0.1, price: 94800, fee: 4.74, pnl: 0, executedAt: "2026-03-07T23:45:00Z" },
    { id: "t-4", market: "STRK-USD", side: "sell", size: 500, price: 2.28, fee: 0.57, pnl: 80, executedAt: "2026-03-07T23:30:00Z" },
    { id: "t-5", market: "ETH-USD", side: "buy", size: 1.5, price: 4750, fee: 3.56, pnl: 0, executedAt: "2026-03-07T23:00:00Z" },
];
const seedFunding = [
    { id: "f-1", market: "BTC-USD", rate: 0.0125, payment: 8.21, time: "2026-03-08T00:00:00Z" },
    { id: "f-2", market: "ETH-USD", rate: -0.009, payment: -3.12, time: "2026-03-07T23:00:00Z" },
    { id: "f-3", market: "STRK-USD", rate: 0.021, payment: 1.86, time: "2026-03-07T22:00:00Z" },
    { id: "f-4", market: "BTC-USD", rate: 0.011, payment: 7.42, time: "2026-03-07T21:00:00Z" },
    { id: "f-5", market: "ETH-USD", rate: -0.008, payment: -2.64, time: "2026-03-07T20:00:00Z" },
    { id: "f-6", market: "STRK-USD", rate: 0.018, payment: 1.24, time: "2026-03-07T19:00:00Z" },
    { id: "f-7", market: "BTC-USD", rate: 0.010, payment: 6.88, time: "2026-03-07T18:00:00Z" },
];
function computePnl(position) {
    const direction = position.side === "long" ? 1 : -1;
    const pnl = (position.markPrice - position.entryPrice) * position.size * direction;
    const pnlPercent = (pnl / position.margin) * 100;
    return { pnl, pnlPercent };
}
function toParadexMarket(market) {
    if (market.toUpperCase().includes("-PERP"))
        return market;
    return `${market}-PERP`;
}
function fromParadexMarket(market) {
    return market.replace(/-PERP$/i, "");
}
function pickValue(source, keys) {
    for (const key of keys) {
        if (key in source && source[key] != null) {
            return source[key];
        }
    }
    return undefined;
}
function pickString(source, keys, fallback = "") {
    const value = pickValue(source, keys);
    if (typeof value === "string")
        return value;
    if (typeof value === "number")
        return String(value);
    return fallback;
}
function pickNumber(source, keys, fallback = 0) {
    const value = pickValue(source, keys);
    if (typeof value === "number")
        return value;
    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }
    return fallback;
}
function toIsoTimestamp(value) {
    if (typeof value === "number") {
        return new Date(value).toISOString();
    }
    if (typeof value === "string") {
        const numeric = Number(value);
        if (Number.isFinite(numeric) && value.trim() !== "") {
            return new Date(numeric).toISOString();
        }
        const parsed = Date.parse(value);
        if (!Number.isNaN(parsed))
            return new Date(parsed).toISOString();
    }
    return new Date().toISOString();
}
function mapParadexPosition(raw) {
    const marketRaw = pickString(raw, ["market", "symbol"]);
    const market = fromParadexMarket(marketRaw);
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
    const leverage = Math.max(pickNumber(raw, ["leverage", "position_leverage", "leverage_ratio"], 1), 1);
    const margin = pickNumber(raw, ["margin", "initial_margin", "position_margin", "cost"], 0) ||
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
    if (!markPrice)
        markPrice = entryPrice || 0;
    const openedAt = toIsoTimestamp(pickValue(raw, ["created_at", "opened_at", "openedAt", "updated_at"]));
    const id = pickString(raw, ["id", "position_id", "positionId"], `${market}-${side}-${openedAt}`);
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
function normalizeOrderStatus(statusRaw) {
    const status = statusRaw.toUpperCase();
    if (["OPEN", "NEW", "PENDING"].includes(status))
        return "open";
    if (["PARTIAL", "PARTIALLY_FILLED"].includes(status))
        return "partial";
    if (["FILLED", "CLOSED"].includes(status))
        return "filled";
    if (["CANCELED", "CANCELLED", "REJECTED"].includes(status))
        return "canceled";
    return "open";
}
function mapParadexOrder(raw) {
    const marketRaw = pickString(raw, ["market", "symbol"]);
    const market = fromParadexMarket(marketRaw);
    const sideRaw = pickString(raw, ["side"]);
    const side = sideRaw.toUpperCase() === "SELL" ? "sell" : "buy";
    const typeRaw = pickString(raw, ["type"]);
    const typeUpper = typeRaw.toUpperCase();
    const type = typeUpper.startsWith("STOP") ? "stop" : typeUpper === "MARKET" ? "market" : "limit";
    const price = pickNumber(raw, ["price", "trigger_price", "triggerPrice"], 0);
    const size = pickNumber(raw, ["size", "remaining_size", "remainingSize"], 0);
    const status = normalizeOrderStatus(pickString(raw, ["status"], "OPEN"));
    const id = pickString(raw, ["id", "order_id", "orderId"], `${market}-${Date.now()}`);
    return { id, market, side, type, price, size, status };
}
function mapParadexTrade(raw) {
    const marketRaw = pickString(raw, ["market", "symbol"]);
    const market = fromParadexMarket(marketRaw);
    const sideRaw = pickString(raw, ["side"]);
    const side = sideRaw.toUpperCase() === "SELL" ? "sell" : "buy";
    const size = pickNumber(raw, ["size", "quantity", "qty"], 0);
    const price = pickNumber(raw, ["price"], 0);
    const fee = pickNumber(raw, ["fee", "commission"], 0);
    const pnl = pickNumber(raw, ["pnl"], 0);
    const executedAt = toIsoTimestamp(pickValue(raw, ["timestamp", "time", "executed_at", "executedAt"]));
    const id = pickString(raw, ["id", "trade_id", "tradeId"], `${market}-${Date.now()}`);
    return { id, market, side, size, price, fee, pnl, executedAt };
}
function mapParadexFunding(raw) {
    const marketRaw = pickString(raw, ["market", "symbol"]);
    const market = fromParadexMarket(marketRaw);
    const rate = pickNumber(raw, ["fundingRate", "funding_rate", "rate"], 0);
    const payment = pickNumber(raw, ["payment", "fundingPayment", "funding_payment"], 0);
    const time = toIsoTimestamp(pickValue(raw, ["time", "timestamp", "paid_at", "paidAt"]));
    const id = pickString(raw, ["id"], `${market}-${time}`);
    return { id, market, rate, payment, time };
}
app.get("/api/positions", async (req, reply) => {
    if (paradexClient) {
        try {
            const raw = await paradexClient.getPositions();
            const positions = raw
                .map((pos) => mapParadexPosition(pos))
                .sort((a, b) => b.openedAt.localeCompare(a.openedAt));
            return { positions };
        }
        catch (error) {
            console.error("Failed to fetch Paradex positions:", error);
        }
    }
    const positions = seedPositions.map((pos) => {
        const { pnl, pnlPercent } = computePnl(pos);
        return { ...pos, pnl, pnlPercent };
    });
    return { positions };
});
app.get("/api/orders", async (req, reply) => {
    const market = req.query.market;
    if (paradexClient) {
        try {
            const raw = await paradexClient.getOpenOrders(market ? toParadexMarket(market) : undefined);
            const orders = raw.map((order) => mapParadexOrder(order));
            return { orders };
        }
        catch (error) {
            console.error("Failed to fetch Paradex orders:", error);
        }
    }
    return { orders: seedOrders };
});
app.get("/api/trades", async (req, reply) => {
    const query = req.query;
    const page = Number(query.page) || 1;
    const market = query.market;
    if (paradexClient) {
        try {
            const paradexMarket = toParadexMarket(market || "BTC-USD");
            const tradesResponse = await paradexClient.getTrades(paradexMarket, PAGE_SIZE);
            const items = tradesResponse.trades.map((trade) => mapParadexTrade(trade));
            return { items, total: items.length };
        }
        catch (error) {
            console.error("Failed to fetch Paradex trades:", error);
        }
    }
    const start = (page - 1) * PAGE_SIZE;
    const items = seedTrades.slice(start, start + PAGE_SIZE);
    return { items, total: seedTrades.length };
});
app.get("/api/funding", async (req, reply) => {
    const query = req.query;
    const page = Number(query.page) || 1;
    const market = query.market;
    if (paradexClient) {
        try {
            const paradexMarket = market ? toParadexMarket(market) : undefined;
            const fundingResponse = await paradexClient.getFundingPayments(paradexMarket, PAGE_SIZE);
            const items = fundingResponse.payments.map((payment) => mapParadexFunding(payment));
            return { items, total: items.length };
        }
        catch (error) {
            console.error("Failed to fetch Paradex funding:", error);
        }
    }
    const start = (page - 1) * PAGE_SIZE;
    const items = seedFunding.slice(start, start + PAGE_SIZE);
    return { items, total: seedFunding.length };
});
// DEX Integration Routes
const orderRouter = getOrderRouter();
const dexClients = new Map();
let extendedClient = null;
let paradexClient = null;
// Initialize DEX clients if credentials are available
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
const hasParadexAuth = Boolean(env.PARADEX_JWT_TOKEN ||
    (env.PARADEX_STARKNET_ADDRESS && env.PARADEX_STARKNET_PRIVATE_KEY));
if (hasParadexAuth) {
    const defaultParadexUrl = env.NODE_ENV === "production"
        ? "https://api.prod.paradex.trade"
        : "https://api.testnet.paradex.trade";
    const paradexBaseUrl = env.PARADEX_API_URL || env.PARADEX_REST_URL || defaultParadexUrl;
    const isTestnet = paradexBaseUrl.toLowerCase().includes("testnet");
    paradexClient = createParadexClient({
        name: "paradex",
        baseUrl: paradexBaseUrl,
        chainId: Number(env.PARADEX_CHAIN_ID ?? ""),
        network: isTestnet ? "sepolia" : "mainnet",
        credentials: {
            starknetAddress: env.PARADEX_STARKNET_ADDRESS,
            starknetPrivateKey: env.PARADEX_STARKNET_PRIVATE_KEY,
            jwtToken: env.PARADEX_JWT_TOKEN,
        },
    });
    orderRouter.registerExchange("paradex", paradexClient);
    dexClients.set("paradex", paradexClient);
}
// DEX Market routes
app.get("/api/dex/markets", async () => {
    const exchanges = orderRouter.getExchanges();
    const allMarkets = [];
    for (const exchangeName of exchanges) {
        try {
            const client = dexClients.get(exchangeName);
            if (client instanceof ParadexClient) {
                const markets = await client.getMarkets();
                allMarkets.push({ exchange: exchangeName, markets });
                continue;
            }
            if (client instanceof ExtendedClient) {
                const markets = await client.getMarkets();
                allMarkets.push({ exchange: exchangeName, markets });
                continue;
            }
            allMarkets.push({
                exchange: exchangeName,
                markets: [],
            });
        }
        catch (error) {
            console.error(`Failed to fetch markets from ${exchangeName}:`, error);
        }
    }
    return { exchanges, markets: allMarkets };
});
app.get("/api/dex/paradex/account", async (req, reply) => {
    if (!paradexClient) {
        reply.status(400);
        return { error: "paradex_not_configured" };
    }
    try {
        const account = await paradexClient.getAccount();
        return { account };
    }
    catch (error) {
        reply.status(500);
        return { error: "paradex_account_failed", message: error.message };
    }
});
app.get("/api/dex/paradex/balances", async (req, reply) => {
    if (!paradexClient) {
        reply.status(400);
        return { error: "paradex_not_configured" };
    }
    try {
        const balances = await paradexClient.getBalances();
        return { balances };
    }
    catch (error) {
        reply.status(500);
        return { error: "paradex_balances_failed", message: error.message };
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
    if (!user)
        return { error: "missing_wallet_address" };
    const body = dexOrderSchema.safeParse(req.body);
    if (!body.success) {
        reply.status(400);
        return { error: "invalid_order" };
    }
    try {
        const routeRequest = {
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
    }
    catch (error) {
        reply.status(500);
        return { error: "routing_failed", message: error.message };
    }
});
app.get("/api/dex/health", async () => {
    const health = await orderRouter.healthCheck();
    return { exchanges: health };
});
await app.listen({ port: PORT, host: "0.0.0.0" });
