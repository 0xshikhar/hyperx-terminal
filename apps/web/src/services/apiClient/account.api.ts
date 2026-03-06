import { apiClient } from "@/services/apiClient/client";

export type AccountSummaryResponse = {
  balance: number;
  available: number;
  marginUsed: number;
  unrealizedPnl: number;
};

export async function getAccountSummary() {
  const response = await apiClient.get<{ account: AccountSummaryResponse }>("/account");
  return response.data.account;
}
