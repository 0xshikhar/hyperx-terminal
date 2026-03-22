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

const DEFAULT_MARKET_PRICES: Record<string, number> = {
  "BTC-USD": 76045.9,
  "ETH-USD": 2640.5,
  "HYPE-USD": 24.8,
  "SOL-USD": 188.4,
  "STRK-USD": 0.46,
};

function generateFallbackCandles(
  symbol: string,
  basePrice: number,
  intervalSeconds: number,
  count: number,
  toSeconds: number
) {
  const roundedTo = Math.floor(toSeconds / intervalSeconds) * intervalSeconds;
  const candles = [];
  let price = basePrice;

  for (let i = count - 1; i >= 0; i--) {
    const time = roundedTo - i * intervalSeconds;
    const seed = Math.sin(time + symbol.charCodeAt(0)) * 10000;
    const change = (seed - Math.floor(seed) - 0.495) * 0.003;
    const open = Math.round(price * 100) / 100;
    const close = Math.round(open * (1 + change) * 100) / 100;
    const wickHigh = Math.abs((Math.sin(time * 1.5) - Math.floor(Math.sin(time * 1.5))) * 0.0015 * open);
    const wickLow = Math.abs((Math.cos(time * 1.2) - Math.floor(Math.cos(time * 1.2))) * 0.0015 * open);
    const high = Math.round((Math.max(open, close) + wickHigh) * 100) / 100;
    const low = Math.round((Math.min(open, close) - wickLow) * 100) / 100;

    candles.push({ time, open, high, low, close });
    price = close;
  }
  return candles;
}

export async function marketRoutes(app: FastifyInstance) {
  app.get("/api/markets", async (req) => {
    const network = getParadexNetwork(req);
    const marketClient = getParadexMarketClient(network);
    if (!marketClient) return { markets: [] };

    try {
      const summaryMap = new Map<string, Record<string, unknown>>();
      try {
        if ("getMarketsSummary" in marketClient && typeof marketClient.getMarketsSummary === "function") {
          const summaries = await marketClient.getMarketsSummary("ALL");
          for (const s of summaries) {
            const sym = fromParadexMarketSymbol(String(s.symbol ?? s.market ?? ""));
            summaryMap.set(sym, s);
          }
        }
      } catch {
        // Summary failed, continue with getMarkets
      }

      const markets = await marketClient.getMarkets();
      const raw = markets as unknown as Record<string, unknown>[];
      const mapped = raw
        .filter((m) => isCorePerpMarket(m))
        .map((m) => {
          const rawMarket = (m.market ?? m.symbol ?? "") as string;
          const symbol = fromParadexMarketSymbol(rawMarket);
          const summary = summaryMap.get(symbol);
          const lastPrice = Number(
            summary?.last_traded_price ??
            summary?.mark_price ??
            m.lastPrice ??
            m.indexPrice ??
            DEFAULT_MARKET_PRICES[symbol] ??
            0
          );
          const rawChange = Number(
            summary?.price_change_rate_24h ??
            summary?.change_percent_24h ??
            m.changePercent24h ??
            0
          );
          const changePercent24h = Math.abs(rawChange) < 1 ? rawChange * 100 : rawChange;
          const volume24h = Number(
            summary?.total_volume ??
            summary?.volume_24h ??
            m.volume24h ??
            0
          );
          const openInterest = Number(
            summary?.open_interest ??
            m.openInterest ??
            0
          );
          const fundingRate = Number(
            summary?.funding_rate ??
            m.fundingRate ??
            0
          );

          return {
            symbol,
            name: (m.name ?? m.baseCurrency ?? symbol ?? "") as string,
            lastPrice,
            changePercent24h: Math.round(changePercent24h * 100) / 100,
            volume24h: Math.round(volume24h * 100) / 100,
            openInterest: Math.round(openInterest * 100) / 100,
            fundingRate,
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
    const intervalSec = CANDLE_INTERVAL_SECONDS[interval] ?? 60;
    const to = Math.floor(Date.now() / 1000);
    const from = to - intervalSec * limit;
    const normalizedSymbol = normalizeMarketSymbol(params.data.market);

    const network = getParadexNetwork(req);
    const candleClient = getParadexClient(network) ?? getParadexMarketClient(network);

    if (candleClient) {
      try {
        const market = toParadexMarketSymbol(normalizedSymbol);
        const response = await candleClient.getCandles(market, interval, from, to);
        if (response.candles && response.candles.length > 0) {
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
            isReference: false,
          };
        }
      } catch {
        // Fall back to synthetic reference candles below
      }
    }

    const basePrice = DEFAULT_MARKET_PRICES[normalizedSymbol] ?? 100;
    const fallbackCandles = generateFallbackCandles(
      normalizedSymbol,
      basePrice,
      intervalSec,
      limit,
      to
    );

    return {
      market: normalizedSymbol,
      interval,
      candles: fallbackCandles,
      isReference: true,
    };
  });
}
