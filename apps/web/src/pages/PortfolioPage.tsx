import { useEffect, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
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
import {
  listFundingHistory,
  listTradeHistory,
  type FundingHistoryDto,
  type TradeHistoryDto,
} from "@/services/apiClient/positions.api";
import { buildPortfolioPnlHistory } from "@/lib/portfolioAnalytics";

export function PortfolioPage() {
  const location = useLocation();
  const { positions } = usePositions();
  const performanceRef = useRef<HTMLDivElement | null>(null);
  const journalRef = useRef<HTMLDivElement | null>(null);
  const shortcutsRef = useRef<HTMLDivElement | null>(null);

  const historyQueries = useQueries({
    queries: positions.map((position) => ({
      queryKey: ["portfolio-history", position.market],
      queryFn: async () => {
        const [trades, funding] = await Promise.all([
          listTradeHistory(1, position.market),
          listFundingHistory(1, position.market),
        ]);

        return {
          market: position.market,
          trades: trades.items,
          funding: funding.items,
        };
      },
      enabled: positions.length > 0,
      staleTime: 60_000,
      retry: false,
    })),
  });

  const historyByMarket = useMemo(
    () =>
      new Map<
        string,
        { trades: TradeHistoryDto[]; funding: FundingHistoryDto[] }
      >(
        historyQueries
          .map((query) => query.data)
          .filter(
            (
              data
            ): data is {
              market: string;
              trades: TradeHistoryDto[];
              funding: FundingHistoryDto[];
            } => Boolean(data)
          )
          .map((data) => [data.market, data] as const)
      ),
    [historyQueries]
  );

  const riskPositions = useMemo(
    () =>
      positions.map((position) => {
        const history = historyByMarket.get(position.market);

        return {
          market: position.market,
          size: position.size,
          side: position.side,
          entryPrice: position.entryPrice,
          markPrice: position.markPrice,
          pnl: position.pnl,
          pnlHistory: buildPortfolioPnlHistory(
            position,
            history?.trades ?? [],
            history?.funding ?? []
          ),
        };
      }),
    [historyByMarket, positions]
  );

  const rebalanceTargets = useMemo(
    () =>
      positions.map((position) => ({
        market: position.market,
        targetPercent: Math.max(10, Math.round(100 / Math.max(positions.length, 1))),
      })),
    [positions]
  );

  useEffect(() => {
    const hash = location.hash.replace("#", "");
    const anchors: Record<string, HTMLDivElement | null> = {
      performance: performanceRef.current,
      journal: journalRef.current,
      shortcuts: shortcutsRef.current,
    };

    if (!hash || !anchors[hash]) return;
    anchors[hash]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.hash]);

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
      <div id="performance" ref={performanceRef}>
        <PerformanceDashboard />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <PriceAlertsV2 />
        <div id="journal" ref={journalRef}>
          <TradeJournal />
        </div>
      </div>
      <div id="shortcuts" ref={shortcutsRef}>
        <ShortcutCustomizer />
      </div>
      <PreferencesCard />
      <PositionsTabs />
    </div>
  );
}
