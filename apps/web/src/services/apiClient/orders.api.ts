import { apiClient } from "@/services/apiClient/client";
import type { TradeOrder } from "@/components/trade-form/TradeForm";

export type PlaceOrderResponse = {
  id: string;
};

export async function placeOrder(order: TradeOrder) {
  const response = await apiClient.post<PlaceOrderResponse>("/orders", order);
  return response.data;
}
