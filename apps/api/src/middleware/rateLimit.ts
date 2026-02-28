import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { redis } from "../cache/redisClient";

type RateLimitOptions = {
  maxPerMinute: number;
};

const inMemory = new Map<string, { count: number; resetAt: number }>();

export async function registerRateLimit(app: FastifyInstance, options: RateLimitOptions) {
  app.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.url === "/health" || req.url.startsWith("/api/health")) return;

    const ip = req.ip ?? "unknown";
    const walletHeader = req.headers["x-wallet-address"];
    const wallet = typeof walletHeader === "string" ? walletHeader.toLowerCase() : "";
    const key = wallet ? `wallet:${wallet}` : `ip:${ip}`;
    const max = options.maxPerMinute;

    if (redis) {
      try {
        const redisKey = `ratelimit:${key}`;
        const current = await redis.incr(redisKey);
        if (current === 1) {
          await redis.expire(redisKey, 60);
        }
        if (current > max) {
          reply.status(429);
          return reply.send({ error: "rate_limited" });
        }
        return;
      } catch {
        // Redis unreachable — fall through to in-memory rate limiter
      }
    }

    const now = Date.now();
    const existing = inMemory.get(key);
    if (!existing || now >= existing.resetAt) {
      inMemory.set(key, { count: 1, resetAt: now + 60_000 });
      return;
    }

    existing.count += 1;
    if (existing.count > max) {
      reply.status(429);
      return reply.send({ error: "rate_limited" });
    }
  });
}

