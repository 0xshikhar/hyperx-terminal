import type { FastifyInstance } from "fastify";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env } from "../config/env.js";

const marketTickSchema = z.discriminatedUnion("channel", [
  z.object({
    channel: z.literal("orderbook"),
    network: z.enum(["testnet", "mainnet"]),
    market: z.string(),
    bids: z.array(z.tuple([z.string(), z.string()])),
    asks: z.array(z.tuple([z.string(), z.string()])),
    sequence: z.number().optional(),
    ts: z.number(),
  }),
  z.object({
    channel: z.literal("ticker"),
    network: z.enum(["testnet", "mainnet"]),
    market: z.string(),
    price: z.number().optional(),
    volume24h: z.number().optional(),
    change24h: z.number().optional(),
    ts: z.number(),
  }),
  z.object({
    channel: z.literal("trades"),
    network: z.enum(["testnet", "mainnet"]),
    market: z.string(),
    trades: z.array(
      z.object({
        id: z.string(),
        price: z.number(),
        size: z.number(),
        side: z.enum(["buy", "sell"]),
        ts: z.number(),
      })
    ),
    ts: z.number(),
  }),
]);

const internalTicksSchema = z.object({
  ticks: z.array(marketTickSchema),
});

export type MarketTick = z.infer<typeof marketTickSchema>;

export function verifyHmacSignature(
  secret: string,
  timestamp: string,
  rawBody: string,
  signatureHeader: string
): boolean {
  if (!signatureHeader.startsWith("sha256=")) return false;
  const providedHash = signatureHeader.slice(7);

  const hmac = createHmac("sha256", secret);
  hmac.update(`${timestamp}.${rawBody}`);
  const expectedHash = hmac.digest("hex");

  try {
    return timingSafeEqual(
      Buffer.from(providedHash, "hex"),
      Buffer.from(expectedHash, "hex")
    );
  } catch {
    return false;
  }
}

export async function internalRoutes(app: FastifyInstance) {
  app.post("/internal/ticks", { logLevel: "warn" }, async (req, reply) => {
    const hmacSecret = process.env.INGEST_HMAC_SECRET || env.JWT_SECRET;
    const sigHeader = req.headers["x-hyperx-ingest"] as string | undefined;
    const tsHeader = req.headers["x-hyperx-timestamp"] as string | undefined;

    if (!sigHeader || !tsHeader) {
      reply.status(401);
      return { error: "missing_ingest_auth" };
    }

    // Protect against replay attacks > 60s
    const reqTs = Number(tsHeader);
    if (!Number.isFinite(reqTs) || Math.abs(Date.now() - reqTs) > 60_000) {
      reply.status(401);
      return { error: "stale_timestamp" };
    }

    const rawBody = JSON.stringify(req.body);
    if (!verifyHmacSignature(hmacSecret, tsHeader, rawBody, sigHeader)) {
      reply.status(403);
      return { error: "invalid_hmac_signature" };
    }

    const parsed = internalTicksSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.status(400);
      return { error: "invalid_ticks_payload", details: parsed.error.flatten() };
    }

    return { accepted: parsed.data.ticks.length };
  });
}
