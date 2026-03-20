import { apiClient } from "@/services/apiClient/client";
import type { TradeOrder } from "@/components/trade-form/TradeForm";

export type PlaceOrderPayload = TradeOrder & {
  signature?: string;
  signatureTimestamp?: number;
  clientId?: string;
};

export type PlaceOrderResponse = {
  id: string;
};

export async function placeOrder(order: PlaceOrderPayload) {
  const response = await apiClient.post<PlaceOrderResponse>("/orders", order);
  return response.data;
}
