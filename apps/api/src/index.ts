import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { AlertCondition } from "@prisma/client";
import { env } from "./config/env";
import { prisma } from "./db/client";
import { registerRateLimit } from "./middleware/rateLimit";
import { z } from "zod";

const PORT = Number(env.PORT ?? 3001);

const app = Fastify({
  logger: false,
});

await app.register(cors, {
  origin: true,
  credentials: true,
});
await app.register(helmet);
await registerRateLimit(app, { maxPerMinute: 120 });

app.get("/health", async () => ({ ok: true }));

app.get("/api/health", async () => ({ ok: true }));

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

const walletHeaderSchema = z
  .string()
  .min(1)
  .transform((value) => value.toLowerCase());

async function getAuthedUser(req: { headers: Record<string, unknown> }, reply: { status: (code: number) => void }) {
  const header = walletHeaderSchema.safeParse(req.headers["x-wallet-address"]);
  if (!header.success) {
    reply.status(401);
    return null;
  }

  const walletAddress = header.data;
  const user = await prisma.user.upsert({
    where: { walletAddress },
    update: {},
    create: { walletAddress },
    include: { preferences: true },
  });
  return user;
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

await app.listen({ port: PORT, host: "0.0.0.0" });
