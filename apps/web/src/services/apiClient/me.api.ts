import { apiClient } from "@/services/apiClient/client";

export type MeResponse = {
  user: {
    id: string;
    walletAddress: string;
    username: string | null;
    email: string | null;
    createdAt: string;
    preferences: {
      theme: string;
      defaultLeverage: number;
      defaultMarket: string;
      favoriteMarkets: string[];
    } | null;
  };
};

export async function getMe() {
  const response = await apiClient.get<MeResponse>("/me");
  return response.data;
}

