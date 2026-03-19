import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  fromParadexMarketSymbol,
  normalizeMarketSymbol,
  toParadexMarketSymbol,
  CANDLE_INTERVAL_SECONDS,
} from "@hyperx/types/common";
import { getParadexNetwork } from "./helpers.js";
import {
  getParadexMarketClient,
  getParadexClient,
  isCorePerpMarket,
} from "../dex/registry.js";

const candleIntervalSchema = z.enum(["1m", "5m", "15m", "1h", "4h", "1d"]);

const marketCandlesQuerySchema = z.object({
  interval: candleIntervalSchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export async function marketRoutes(app: FastifyInstance) {
  app.get("/api/markets", async (req) => {
    const network = getParadexNetwork(req);
    const marketClient = getParadexMarketClient(network);
    if (!marketClient) return { markets: [] };

    try {
      const markets = await marketClient.getMarkets();
      const raw = markets as unknown as Record<string, unknown>[];
      const mapped = raw
        .filter((m) => isCorePerpMarket(m))
        .map((m) => {
          const rawMarket = (m.market ?? m.symbol ?? "") as string;
          const symbol = fromParadexMarketSymbol(rawMarket);
          return {
            symbol,
            name: (m.name ?? m.baseCurrency ?? symbol ?? "") as string,
            lastPrice: Number(m.lastPrice ?? m.indexPrice ?? m.last_traded_price ?? 0),
            changePercent24h: Number(
              m.changePercent24h ?? m.priceChangePercent24h ?? m.price_change_rate_24h ?? 0
            ),
            volume24h: Number(m.volume24h ?? m.volume_24h ?? 0),
            openInterest: Number(m.openInterest ?? m.open_interest ?? 0),
            fundingRate: Number(m.fundingRate ?? m.funding_rate ?? 0),
          };
        });
      return { markets: mapped };
    } catch (error) {
      console.error("Failed to fetch Paradex markets:", error);
      return { markets: [] };
    }
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
    const from = to - CANDLE_INTERVAL_SECONDS[interval] * limit;

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
    } catch {
      return {
        market: params.data.market,
        interval,
        candles: [],
        isReference: true,
      };
    }
  });
}
