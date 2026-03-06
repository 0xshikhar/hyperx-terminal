import { apiClient } from "@/services/apiClient/client";

export type MetricPayload = {
  name: string;
  value: number;
  timestamp: number;
  meta?: Record<string, unknown>;
};

export async function reportMetrics(metrics: MetricPayload[]) {
  const response = await apiClient.post<{ accepted: number }>("/metrics", { metrics });
  return response.data.accepted;
}
