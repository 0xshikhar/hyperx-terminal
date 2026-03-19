import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import { env } from "./config/env.js";
import { prisma } from "./db/client.js";
import { registerRateLimit } from "./middleware/rateLimit.js";
import { authRoutes } from "./routes/auth.js";
import { marketRoutes } from "./routes/markets.js";
import { accountRoutes } from "./routes/account.js";
import { orderRoutes } from "./routes/orders.js";
import { positionRoutes } from "./routes/positions.js";
import { tradeRoutes } from "./routes/trades.js";
import { fundingRoutes } from "./routes/funding.js";
import { alertRoutes } from "./routes/alerts.js";
import { notificationRoutes } from "./routes/notifications.js";
import { metricRoutes } from "./routes/metrics.js";
import { dexRoutes } from "./routes/dex.js";
import { internalRoutes } from "./routes/internal.js";

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

await app.register(cors, {
  origin:
    env.NODE_ENV === "production"
      ? process.env.CORS_ORIGIN?.split(",") ?? ["https://hyperx.app"]
      : true,
  credentials: true,
});
await app.register(helmet);
await registerRateLimit(app, { maxPerMinute: 120 });

// Health check endpoints
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

// Register routes
await authRoutes(app);
await app.register(
  async (instance) => {
    await authRoutes(instance);
  },
  { prefix: "/api" }
);

await marketRoutes(app);
await accountRoutes(app);
await orderRoutes(app);
await positionRoutes(app);
await tradeRoutes(app);
await fundingRoutes(app);
await alertRoutes(app);
await notificationRoutes(app);
await metricRoutes(app);
await dexRoutes(app);
await internalRoutes(app);

export { app };

if (process.env.VITEST !== "true" && process.env.NODE_ENV !== "test") {
  await app.listen({ port: PORT, host: "0.0.0.0" });
}
