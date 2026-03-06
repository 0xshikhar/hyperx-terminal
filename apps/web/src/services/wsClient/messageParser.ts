import { z } from "zod";

const tickerSchema = z.object({
  type: z.literal("ticker"),
  market: z.string(),
  lastPrice: z.number(),
  changePercent24h: z.number(),
  volume24h: z.number(),
  openInterest: z.number(),
  fundingRate: z.number(),
  timestamp: z.number(),
});

const orderbookSchema = z.object({
  type: z.literal("orderbook"),
  market: z.string(),
  bids: z.array(z.object({ price: z.number(), size: z.number() })),
  asks: z.array(z.object({ price: z.number(), size: z.number() })),
  timestamp: z.number(),
});

const tradesSchema = z.object({
  type: z.literal("trades"),
  market: z.string(),
  trades: z.array(
    z.object({
      id: z.string(),
      side: z.union([z.literal("buy"), z.literal("sell")]),
      price: z.number(),
      size: z.number(),
      timestamp: z.number(),
    })
  ),
  timestamp: z.number(),
});

const statusSchema = z.object({
  type: z.literal("status"),
  blockHeight: z.number().optional(),
  gasPrice: z.string().optional(),
  timestamp: z.number(),
});

const candleSchema = z.object({
  time: z.number(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
});

const candlesSchema = z.object({
  type: z.literal("candles"),
  market: z.string(),
  interval: z.string(),
  candles: z.array(candleSchema),
  timestamp: z.number(),
});

const pongSchema = z.object({
  type: z.literal("pong"),
  timestamp: z.number(),
});

export const serverMessageSchema = z.discriminatedUnion("type", [
  tickerSchema,
  orderbookSchema,
  tradesSchema,
  statusSchema,
  candlesSchema,
  pongSchema,
]);

export type ParsedServerMessage = z.infer<typeof serverMessageSchema>;
