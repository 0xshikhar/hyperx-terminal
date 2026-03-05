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
  };
}

export async function listMarkets(): Promise<MarketSummary[]> {
  try {
    const response = await apiClient.get<{
      exchanges: string[];
      markets: Array<{ exchange: string; markets: Array<Record<string, unknown>> }>;
    }>("/dex/markets");
    const source = response.data.markets.flatMap((entry) => entry.markets ?? []);
    const normalized = source
      .map(toMarketSummary)
      .filter((item): item is MarketSummary => item !== null);

    if (normalized.length > 0) {
      return normalized;
    }
  } catch {
    // Fall back to legacy /markets response.
  }

  const response = await apiClient.get<{ markets: MarketSummary[] }>("/markets");
  return response.data.markets;
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
