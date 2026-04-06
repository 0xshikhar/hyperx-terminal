import { apiClient } from "@/services/apiClient/client";
import type { TradeOrder } from "@/components/trade-form/TradeForm";

export type OrderInstruction = "GTC" | "IOC" | "FOK" | "POST_ONLY";

export type PlaceOrderPayload = TradeOrder & {
  signature?: string;
  signatureTimestamp?: number;
  clientId?: string;
  /** Venue execution instruction (Paradex-style: GTC | IOC | FOK | POST_ONLY). */
  instruction?: OrderInstruction;
};

export type PlaceOrderResponse = {
  id: string;
};

export async function placeOrder(order: PlaceOrderPayload) {
  const response = await apiClient.post<PlaceOrderResponse>("/orders", order);
  return response.data;
}

export type CancelOrderResponse = {
  success: boolean;
};

export async function cancelOrder(orderId: string) {
  const response = await apiClient.delete<CancelOrderResponse>(
    `/orders/${encodeURIComponent(orderId)}`
  );
  return response.data;
}

export type CancelAllOrdersResponse = {
  cancelledCount: number;
};

export async function cancelAllOrders(market?: string) {
  const response = await apiClient.delete<{ canceled: number | string[] }>(
    "/orders",
    { params: market ? { market } : undefined }
  );
  const canceled = response.data?.canceled;
  return {
    cancelledCount: Array.isArray(canceled)
      ? canceled.length
      : typeof canceled === "number"
        ? canceled
        : 0,
  };
}
