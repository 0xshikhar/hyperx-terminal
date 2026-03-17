import { apiClient } from "@/services/apiClient/client";

export type LeaderboardEntry = {
  rank: number;
  trader: string;
  pnl: number;
  winRate: number;
  trades: number;
  badge?: string;
};

export type LeaderboardResponse = {
  leaderboard: LeaderboardEntry[];
  leadersCount: number;
  avgWinRate: string;
  bestPnL: string;
  performanceShape: string;
  executionStyle: string;
};

export async function getLeaderboard() {
  const response = await apiClient.get<LeaderboardResponse>("/leaderboard");
  return response.data;
}
