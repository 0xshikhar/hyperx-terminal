import { apiClient } from "@/services/apiClient/client";
import {
  normalizeMarketSymbol,
  toMarketDisplaySymbol,
} from "@hyperx/types/common";
import type { Candle, CandleInterval } from "@/services/wsClient";

export type MarketSummary = {
  symbol: string;
  venueSymbol?: string;
  displaySymbol?: string;
  name: string;
  lastPrice?: number;
  markPrice?: number;
  oraclePrice?: number;
  changePercent24h?: number;
  volume24h?: number;
  openInterest?: number;
  fundingRate?: number;
};

function toMarketSummary(market: Record<string, unknown>): MarketSummary | null {
  const symbolRaw =
    (market.market as string | undefined) ??
    (market.symbol as string | undefined) ??
    "";
  const baseCurrency =
    (market.baseCurrency as string | undefined) ??
    (market.base_currency as string | undefined) ??
    "";
  const quoteCurrency =
    (market.quoteCurrency as string | undefined) ??
    (market.quote_currency as string | undefined) ??
    "";
  const symbol = normalizeMarketSymbol(symbolRaw || `${baseCurrency}-${quoteCurrency}`);
  if (!symbol) return null;

  const base = baseCurrency || symbol.split("-")[0];
  return {
    symbol,
    venueSymbol: symbolRaw || `${baseCurrency}-${quoteCurrency}` || undefined,
    displaySymbol: toMarketDisplaySymbol(symbol),
    name: base ? base.charAt(0) + base.slice(1).toLowerCase() : symbol,
    lastPrice: typeof market.lastPrice === "number" ? market.lastPrice : undefined,
    markPrice: typeof market.markPrice === "number" ? market.markPrice : undefined,
    oraclePrice: typeof market.oraclePrice === "number" ? market.oraclePrice : undefined,
    changePercent24h: typeof market.changePercent24h === "number" ? market.changePercent24h : undefined,
    volume24h: typeof market.volume24h === "number" ? market.volume24h : undefined,
    openInterest: typeof market.openInterest === "number" ? market.openInterest : undefined,
    fundingRate: typeof market.fundingRate === "number" ? market.fundingRate : undefined,
  };
}

export async function listMarkets(): Promise<MarketSummary[]> {
  try {
    const response = await apiClient.get<{ markets: MarketSummary[] }>("/markets");
    if (response.data?.markets && response.data.markets.length > 0) {
      const seen = new Set<string>();
      return response.data.markets
        .map((m) => {
          const sym = normalizeMarketSymbol(m.symbol);
          return {
            ...m,
            symbol: sym,
            displaySymbol: toMarketDisplaySymbol(sym),
            name: m.name || sym.split("-")[0],
          };
        })
        .filter((m) => {
          if (seen.has(m.symbol)) return false;
          seen.add(m.symbol);
          return true;
        });
    }
  } catch (err) {
    console.warn("Failed to fetch /markets, falling back to /dex/markets:", err);
  }

  try {
    const response = await apiClient.get<{
      exchanges: string[];
      markets: Array<{ exchange: string; markets: Array<Record<string, unknown>> }>;
    }>("/dex/markets");
    const source = response.data.markets.flatMap((entry) => entry.markets ?? []);
    const normalized = source
      .map(toMarketSummary)
      .filter((item): item is MarketSummary => item !== null);

    const seen = new Set<string>();
    const deduped: MarketSummary[] = [];
    for (const m of normalized) {
      if (!seen.has(m.symbol)) {
        seen.add(m.symbol);
        deduped.push(m);
      }
    }
    return deduped;
  } catch {
    return [];
  }
}

export async function getMarketCandles(
  market: string,
  interval: CandleInterval,
  limit = 120
): Promise<{ candles: Candle[]; isReference: boolean }> {
  const response = await apiClient.get<{
    market: string;
    interval: string;
    candles: Candle[];
    isReference?: boolean;
  }>(`/markets/${encodeURIComponent(market)}/candles`, {
    params: {
      interval,
      limit,
    },
  });

  return {
    candles: response.data.candles,
    isReference: response.data.isReference ?? false,
  };
}
