import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { z } from "zod";

const PORT = Number(process.env.PORT ?? 3001);

const app = Fastify({
  logger: false,
});

await app.register(cors, {
  origin: true,
  credentials: true,
});
await app.register(helmet);

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

const orderSchema = z.object({
  market: z.string(),
  side: z.union([z.literal("buy"), z.literal("sell")]),
  type: z.union([z.literal("market"), z.literal("limit")]),
  size: z.string(),
  price: z.string().optional(),
});

app.post("/api/orders", async (req: FastifyRequest, reply: FastifyReply) => {
  const body = orderSchema.safeParse(req.body);
  if (!body.success) {
    reply.status(400);
    return { error: "invalid_order" };
  }

  const id = `${body.data.market}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  return { id };
});

await app.listen({ port: PORT, host: "0.0.0.0" });
