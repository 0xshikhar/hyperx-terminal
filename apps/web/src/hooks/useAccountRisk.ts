import { useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePaperTradingStore } from "@/store/paperTradingStore";
import { useNetworkStore } from "@/store/networkStore";
import { useWallet } from "@/components/wallet/useWallet";
import { getAccountSummary } from "@/services/apiClient/account.api";
import { terminalAudio } from "@/lib/terminalAudio";

export type RiskTier = "healthy" | "caution" | "danger";

export type AccountRiskMetrics = {
  equity: number;
  marginUsed: number;
  maintenanceMargin: number;
  freeMargin: number;
  marginRatio: number; // 0% to 100%
  riskTier: RiskTier;
  adlPriority: number; // 0 to 5 light bars
  effectiveLeverage: number;
  hasOpenPositions: boolean;
  isPaperTrading: boolean;
};

export function useAccountRisk(): AccountRiskMetrics {
  const isWalletConnected = useWallet((s) => s.isConnected);
  const isPaperWallet = useWallet((s) => s.isPaperWallet);
  const networkPaperTrading = useNetworkStore((s) => s.isPaperTrading);
  const isPaperTrading = networkPaperTrading || isPaperWallet;

  // Paper trading state
  const paperBalance = usePaperTradingStore((s) => s.balance);
  const paperPositions = usePaperTradingStore((s) => s.positions);

  // Live account query
  const { data: realAccount } = useQuery({
    queryKey: ["account-summary"],
    queryFn: getAccountSummary,
    enabled: isWalletConnected && !isPaperTrading,
    staleTime: 15_000,
  });

  const metrics = useMemo<AccountRiskMetrics>(() => {
    if (isPaperTrading) {
      const marginUsed = paperPositions.reduce((acc, p) => acc + p.margin, 0);
      const unrealizedPnl = paperPositions.reduce((acc, p) => acc + p.pnl, 0);
      const equity = Math.max(0, paperBalance + marginUsed + unrealizedPnl);
      const maintenanceMargin = marginUsed * 0.5; // Standard 50% maintenance margin requirement

      let marginRatio = 0;
      if (paperPositions.length > 0) {
        marginRatio = equity > 0 ? (maintenanceMargin / equity) * 100 : 100;
      }
      marginRatio = Math.min(100, Math.max(0, marginRatio));

      let riskTier: RiskTier = "healthy";
      if (marginRatio >= 80) {
        riskTier = "danger";
      } else if (marginRatio >= 50) {
        riskTier = "caution";
      }

      // Compute ADL Priority based on best position profit * leverage
      let adlPriority = 0;
      if (paperPositions.length > 0) {
        let maxRank = 0;
        for (const pos of paperPositions) {
          const rank = Math.max(0, pos.pnlPercent) * (pos.leverage || 10);
          if (rank > maxRank) maxRank = rank;
        }

        if (maxRank > 800) adlPriority = 5;
        else if (maxRank > 400) adlPriority = 4;
        else if (maxRank > 150) adlPriority = 3;
        else if (maxRank > 20) adlPriority = 2;
        else adlPriority = 1;
      }

      const totalNotional = paperPositions.reduce(
        (acc, p) => acc + p.size * p.entryPrice,
        0
      );
      const effectiveLeverage = equity > 0 ? totalNotional / equity : 0;

      return {
        equity,
        marginUsed,
        maintenanceMargin,
        freeMargin: Math.max(0, paperBalance),
        marginRatio,
        riskTier,
        adlPriority,
        effectiveLeverage,
        hasOpenPositions: paperPositions.length > 0,
        isPaperTrading: true,
      };
    }

    // Real Account
    const equity = realAccount?.balance ?? 0;
    const marginUsed = realAccount?.marginUsed ?? 0;
    const freeMargin = realAccount?.available ?? 0;
    const maintenanceMargin = marginUsed * 0.5;

    let marginRatio = 0;
    if (marginUsed > 0) {
      marginRatio = equity > 0 ? (maintenanceMargin / equity) * 100 : 100;
    }
    marginRatio = Math.min(100, Math.max(0, marginRatio));

    let riskTier: RiskTier = "healthy";
    if (marginRatio >= 80) {
      riskTier = "danger";
    } else if (marginRatio >= 50) {
      riskTier = "caution";
    }

    const hasOpenPositions = marginUsed > 0;
    const adlPriority = hasOpenPositions ? 2 : 0;

    return {
      equity,
      marginUsed,
      maintenanceMargin,
      freeMargin,
      marginRatio,
      riskTier,
      adlPriority,
      effectiveLeverage: equity > 0 ? (marginUsed * 10) / equity : 0,
      hasOpenPositions,
      isPaperTrading: false,
    };
  }, [isPaperTrading, paperBalance, paperPositions, realAccount]);

  // Tactile audio alarm when entering liquidation / margin danger zone (>= 80%)
  const prevRiskTierRef = useRef<RiskTier>(metrics.riskTier);
  useEffect(() => {
    if (metrics.riskTier === "danger" && prevRiskTierRef.current !== "danger") {
      terminalAudio.playAlert();
    }
    prevRiskTierRef.current = metrics.riskTier;
  }, [metrics.riskTier]);

  return metrics;
}
