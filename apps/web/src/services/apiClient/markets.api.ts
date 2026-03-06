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
  const response = await apiClient.get<{ markets: MarketSummary[] }>("/markets");
  return response.data.markets;
}
