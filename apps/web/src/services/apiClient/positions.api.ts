import { apiClient } from "@/services/apiClient/client";

export type PositionDto = {
  id: string;
  market: string;
  side: "long" | "short";
  size: number;
  entryPrice: number;
  markPrice: number;
  leverage: number;
  margin: number;
  openedAt: string;
};

export type OrderDto = {
  id: string;
  market: string;
  side: "buy" | "sell";
  type: "limit" | "market" | "stop";
  price: number;
  size: number;
  status: string;
};

export type TradeHistoryDto = {
  id: string;
  market: string;
  side: "buy" | "sell";
  size: number;
  price: number;
  fee: number;
  pnl: number;
  executedAt: string;
};

export type FundingHistoryDto = {
  id: string;
  market: string;
  rate: number;
  payment: number;
  time: string;
};

export async function listOpenPositions() {
  const response = await apiClient.get<{ positions: PositionDto[] }>("/positions");
  return response.data.positions;
}

export async function listOpenOrders() {
  const response = await apiClient.get<{ orders: OrderDto[] }>("/orders");
  return response.data.orders;
}

export async function listTradeHistory(page = 1) {
  const response = await apiClient.get<{ items: TradeHistoryDto[]; total: number }>(
    `/trades?page=${page}`
  );
  return response.data;
}

export async function listFundingHistory(page = 1) {
  const response = await apiClient.get<{ items: FundingHistoryDto[]; total: number }>(
    `/funding?page=${page}`
  );
  return response.data;
}
