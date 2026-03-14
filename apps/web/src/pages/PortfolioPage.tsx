import { useMemo } from "react";
import { AccountSummary } from "@/components/account/AccountSummary";
import { PreferencesCard } from "@/components/account/PreferencesCard";
import { PositionsTabs } from "@/components/positions/PositionsTabs";
import { RealTimePnL } from "@/components/positions/RealTimePnL";
import { PositionHeatmap } from "@/components/positions/PositionHeatmap";
import { RiskAnalytics } from "@/components/analytics/RiskAnalytics";
import { CorrelationMatrix } from "@/components/analytics/CorrelationMatrix";
import { PortfolioRebalancing } from "@/components/analytics/PortfolioRebalancing";
import { PerformanceDashboard } from "@/components/monitoring/PerformanceDashboard";
import { PriceAlertsV2 } from "@/components/alerts/PriceAlertsV2";
import { TradeJournal } from "@/components/journal/TradeJournal";
import { ShortcutCustomizer } from "@/components/keyboard-shortcuts/ShortcutCustomizer";
import { usePositions } from "@/hooks/usePositions";

export function PortfolioPage() {
  const { positions } = usePositions();

  const riskPositions = useMemo(
    () =>
      positions.map((position, index) => ({
        market: position.market,
        size: position.size,
        side: position.side,
        entryPrice: position.entryPrice,
        markPrice: position.markPrice,
        pnl: position.pnl,
        pnlHistory: Array.from({ length: 30 }, (_, day) => position.pnl * ((day + 1) / 30) * (index % 2 === 0 ? 1 : 0.8)),
      })),
    [positions]
  );

  const rebalanceTargets = useMemo(
    () =>
      positions.map((position) => ({
        market: position.market,
        targetPercent: Math.max(10, Math.round(100 / Math.max(positions.length, 1))),
      })),
    [positions]
  );

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Portfolio</h1>
      <AccountSummary />
      <div className="grid gap-6 xl:grid-cols-2">
        <RealTimePnL positions={positions} />
        <PositionHeatmap positions={positions} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <RiskAnalytics positions={riskPositions} />
        <CorrelationMatrix positions={riskPositions.map(({ market, pnlHistory }) => ({ market, pnlHistory }))} />
      </div>
      <PortfolioRebalancing
        positions={positions}
        targets={rebalanceTargets}
        onRebalance={() => {}}
      />
      <PerformanceDashboard />
      <div className="grid gap-6 xl:grid-cols-2">
        <PriceAlertsV2 />
        <TradeJournal />
      </div>
      <ShortcutCustomizer />
      <PreferencesCard />
      <PositionsTabs />
    </div>
  );
}
