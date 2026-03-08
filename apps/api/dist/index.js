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
import { getOrderRouter, createExtendedClient, createParadexClient } from "./dex/index.js";
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
    },
    {
        symbol: "ETH-USD",
        name: "Ethereum",
    },
    {
        symbol: "STRK-USD",
        name: "StarkNet",
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
    type: z.union([z.literal("market"), z.literal("limit")]),
    size: z.string(),
    price: z.string().optional(),
});
app.post("/api/orders", async (req, reply) => {
    const body = orderSchema.safeParse(req.body);
    if (!body.success) {
        reply.status(400);
        return { error: "invalid_order" };
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
app.get("/api/positions", async (req, reply) => {
    const positions = seedPositions.map((pos) => {
        const { pnl, pnlPercent } = computePnl(pos);
        return { ...pos, pnl, pnlPercent };
    });
    return { positions };
});
app.get("/api/orders", async (req, reply) => {
    return { orders: seedOrders };
});
app.get("/api/trades", async (req, reply) => {
    const page = Number(req.query.page) || 1;
    const start = (page - 1) * PAGE_SIZE;
    const items = seedTrades.slice(start, start + PAGE_SIZE);
    return { items, total: seedTrades.length };
});
app.get("/api/funding", async (req, reply) => {
    const page = Number(req.query.page) || 1;
    const start = (page - 1) * PAGE_SIZE;
    const items = seedFunding.slice(start, start + PAGE_SIZE);
    return { items, total: seedFunding.length };
});
// DEX Integration Routes
const orderRouter = getOrderRouter();
// Initialize DEX clients if credentials are available
if (env.EXTENDED_API_KEY && env.EXTENDED_API_SECRET) {
    const extendedClient = createExtendedClient({
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
}
if (env.PARADEX_API_KEY && env.PARADEX_API_SECRET) {
    const paradexClient = createParadexClient({
        name: "paradex",
        baseUrl: env.PARADEX_API_URL || "https://api.prod.paradex.trade",
        chainId: Number(env.PARADEX_CHAIN_ID) || 1,
        network: "mainnet",
        credentials: {
            apiKey: env.PARADEX_API_KEY,
            apiSecret: env.PARADEX_API_SECRET,
        },
    });
    orderRouter.registerExchange("paradex", paradexClient);
}
// DEX Market routes
app.get("/api/dex/markets", async () => {
    const exchanges = orderRouter.getExchanges();
    const allMarkets = [];
    for (const exchangeName of exchanges) {
        try {
            // This would fetch real markets in production
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
