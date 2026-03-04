import { apiClient } from "@/services/apiClient/client";

export type PreferencesInput = {
  theme?: string;
  defaultLeverage?: number;
  defaultMarket?: string;
  favoriteMarkets?: string[];
};

export type PreferencesResponse = {
  preferences: {
    theme: string;
    defaultLeverage: number;
    defaultMarket: string;
    favoriteMarkets: string[];
  };
};

export async function updatePreferences(input: PreferencesInput) {
  const response = await apiClient.put<PreferencesResponse>("/preferences", input);
  return response.data.preferences;
}

