import { apiClient } from "@/services/apiClient/client";

export type AlertCondition = "ABOVE" | "BELOW" | "PERCENT_CHANGE";

export type PriceAlert = {
  id: string;
  market: string;
  condition: AlertCondition;
  targetPrice: string;
  triggered: boolean;
  triggeredAt: string | null;
  createdAt: string;
};

export async function listAlerts() {
  const response = await apiClient.get<{ alerts: PriceAlert[] }>("/alerts");
  return response.data.alerts;
}

export async function createAlert(input: {
  market: string;
  condition: AlertCondition;
  targetPrice: string;
}) {
  const response = await apiClient.post<{ alert: PriceAlert }>("/alerts", input);
  return response.data.alert;
}

export async function deleteAlert(id: string) {
  const response = await apiClient.delete<{ deleted: number }>(`/alerts/${id}`);
  return response.data.deleted;
}

