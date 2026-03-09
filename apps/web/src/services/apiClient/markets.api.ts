import { apiClient } from "@/services/apiClient/client";

export type MarketSummary = {
  symbol: string;
  name: string;
  lastPrice?: number;
  changePercent24h?: number;
  volume24h?: number;
  openInterest?: number;
  fundingRate?: number;
};

export async function listMarkets() {
  try {
    const response = await apiClient.get<{
      exchanges: string[];
      markets: Array<{ exchange: string; markets: Array<Record<string, unknown>> }>;
    }>("/dex/markets");
    const paradex = response.data.markets.find((entry) => entry.exchange === "paradex");
    const source = paradex?.markets ?? [];
    const normalized = source
      .map((market) => {
        const symbolRaw =
          (market.market as string | undefined) ??
          (market.symbol as string | undefined) ??
          "";
        if (!symbolRaw) return null;
        const symbol = symbolRaw.replace(/-PERP$/i, "");
        const base =
          (market.baseCurrency as string | undefined) ??
          (market.base_currency as string | undefined) ??
          symbol.split("-")[0];
        return {
          symbol,
          name: base ? base.charAt(0) + base.slice(1).toLowerCase() : symbol,
        } satisfies MarketSummary;
      })
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
