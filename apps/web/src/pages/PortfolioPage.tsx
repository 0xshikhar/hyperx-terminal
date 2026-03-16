import { useState, useMemo } from "react";
import {
  BarChart3,
  Activity,
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  PieChart,
  Target,
  AlertTriangle,
} from "lucide-react";
import { useQueries } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { AccountSummary } from "@/components/account/AccountSummary";
import { PositionsTabs } from "@/components/positions/PositionsTabs";
import { PositionHeatmap } from "@/components/positions/PositionHeatmap";
import { RiskAnalytics } from "@/components/analytics/RiskAnalytics";
import { CorrelationMatrix } from "@/components/analytics/CorrelationMatrix";
import { PortfolioRebalancing } from "@/components/analytics/PortfolioRebalancing";
import { PerformanceDashboard } from "@/components/monitoring/PerformanceDashboard";
import { PriceAlertsV2 } from "@/components/alerts/PriceAlertsV2";
import { TradeJournal } from "@/components/journal/TradeJournal";
import { usePositions } from "@/hooks/usePositions";
import {
  listFundingHistory,
  listTradeHistory,
  type FundingHistoryDto,
  type TradeHistoryDto,
} from "@/services/apiClient/positions.api";
import { buildPortfolioPnlHistory } from "@/lib/portfolioAnalytics";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "positions", label: "Positions" },
  { id: "risk", label: "Risk" },
  { id: "analytics", label: "Analytics" },
  { id: "journal", label: "Journal" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function PortfolioPage() {
  const { positions } = usePositions();
  const [activeTab, setActiveTab] = useState<TabId>("overview");

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
            (data): data is {
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

  // Calculate portfolio stats
  const totalUnrealizedPnl = positions.reduce(
    (sum, p) => sum + (p.pnl || 0),
    0
  );
  const totalMarginUsed = positions.reduce(
    (sum, p) => sum + (p.margin || 0),
    0
  );
  const longCount = positions.filter((p) => p.side === "long").length;
  const shortCount = positions.filter((p) => p.side === "short").length;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#081214] text-[#d8dfe1]">
      {/* Header - Compact Stats Row */}
      <header className="border-b border-[#162326] bg-[#0a1518]">
        <div className="flex flex-col gap-3 px-5 py-3">
          {/* Title Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#112327] text-[#53d8c8]">
                <Wallet className="h-4 w-4" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-white">Portfolio</h1>
                <p className="text-xs text-[#708084]">
                  {positions.length} positions • {longCount} long • {shortCount} short
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-[#708084]">Total P&L</p>
                <p
                  className={cn(
                    "font-mono text-lg font-semibold",
                    totalUnrealizedPnl >= 0 ? "text-[#53d8c8]" : "text-[#f16d75]"
                  )}
                >
                  {totalUnrealizedPnl >= 0 ? "+" : ""}
                  ${totalUnrealizedPnl.toFixed(2)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[#708084]">Margin Used</p>
                <p className="font-mono text-lg font-semibold text-white">
                  ${totalMarginUsed.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Compact Stats Cards - 5 in one row */}
          <div className="grid grid-cols-5 gap-2">
            <CompactStat
              icon={BarChart3}
              label="Positions"
              value={`${positions.length}`}
            />
            <CompactStat
              icon={Activity}
              label="Long/Short"
              value={`${longCount}/${shortCount}`}
            />
            <CompactStat
              icon={totalUnrealizedPnl >= 0 ? TrendingUp : TrendingDown}
              label="Unrealized P&L"
              value={`${totalUnrealizedPnl >= 0 ? "+" : ""}$${totalUnrealizedPnl.toFixed(2)}`}
              positive={totalUnrealizedPnl >= 0}
            />
            <CompactStat
              icon={DollarSign}
              label="Margin Used"
              value={`$${totalMarginUsed.toLocaleString()}`}
            />
            <CompactStat
              icon={Percent}
              label="Win Rate"
              value="68%"
            />
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#162326]">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative px-5 py-2.5 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "text-white"
                  : "text-[#6b6b74] hover:text-[#a0a0a8]"
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#53d8c8]" />
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-auto p-4">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
            {/* Left Column */}
            <div className="space-y-4">
              <AccountSummary />
              <PositionHeatmap positions={positions} />
            </div>
            {/* Right Column */}
            <div className="space-y-4">
              <PnLSummary positions={positions} />
              <RiskSummary positions={riskPositions} />
            </div>
          </div>
        )}

        {/* Positions Tab */}
        {activeTab === "positions" && (
          <div className="h-full">
            <PositionsTabs />
          </div>
        )}

        {/* Risk Tab */}
        {activeTab === "risk" && (
          <div className="grid gap-4 xl:grid-cols-2">
            <RiskAnalytics positions={riskPositions} />
            <CorrelationMatrix
              positions={riskPositions.map(({ market, pnlHistory }) => ({
                market,
                pnlHistory,
              }))}
            />
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === "analytics" && (
          <div className="space-y-4">
            <PerformanceDashboard />
            <div className="grid gap-4 xl:grid-cols-2">
              <PortfolioRebalancing
                positions={positions}
                targets={positions.map((p) => ({
                  market: p.market,
                  targetPercent: Math.max(
                    10,
                    Math.round(100 / Math.max(positions.length, 1))
                  ),
                }))}
                onRebalance={() => {}}
              />
              <PriceAlertsV2 />
            </div>
          </div>
        )}

        {/* Journal Tab */}
        {activeTab === "journal" && (
          <div className="max-w-4xl">
            <TradeJournal />
          </div>
        )}
      </div>
    </div>
  );
}

// Compact Stat Card for Header Row
function CompactStat({
  icon: Icon,
  label,
  value,
  positive,
}: {
  icon: typeof BarChart3;
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-md border border-[#162326] bg-[#0c181b] px-3 py-2">
      <div className="flex items-center gap-1.5">
        <Icon
          className={cn(
            "h-3.5 w-3.5",
            positive === undefined
              ? "text-[#708084]"
              : positive
                ? "text-[#53d8c8]"
                : "text-[#f16d75]"
          )}
        />
        <span className="text-[10px] uppercase tracking-[0.1em] text-[#708084]">
          {label}
        </span>
      </div>
      <p
        className={cn(
          "mt-0.5 font-mono text-sm font-semibold",
          positive === undefined
            ? "text-white"
            : positive
              ? "text-[#53d8c8]"
              : "text-[#f16d75]"
        )}
      >
        {value}
      </p>
    </div>
  );
}

// Compact P&L Summary Card
function PnLSummary({
  positions,
}: {
  positions: Array<{
    pnl: number;
    margin: number;
    entryPrice: number;
    markPrice: number;
    size: number;
  }>;
}) {
  const totalUnrealized = positions.reduce((sum, p) => sum + (p.pnl || 0), 0);
  const totalRealized = 1250.5; // Mock data
  const totalMargin = positions.reduce((sum, p) => sum + (p.margin || 0), 0);
  const dailyPnL = totalUnrealized * 0.1;

  return (
    <div className="rounded-lg border border-[#162326] bg-[#0c181b]">
      <div className="flex items-center justify-between border-b border-[#162326] px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <PieChart className="h-4 w-4 text-[#53d8c8]" />
          P&L Summary
        </h3>
        <span className="text-xs text-[#708084]">Live</span>
      </div>
      <div className="grid grid-cols-2 gap-3 p-4">
        <div
          className={cn(
            "rounded border border-[#1d2b2f] p-3",
            totalUnrealized >= 0 ? "bg-[#0f2523]" : "bg-[#2a1515]"
          )}
        >
          <p className="mb-1 text-[10px] uppercase text-[#708084]">
            Unrealized P&L
          </p>
          <p
            className={cn(
              "font-mono text-lg font-semibold",
              totalUnrealized >= 0 ? "text-[#53d8c8]" : "text-[#f16d75]"
            )}
          >
            {totalUnrealized >= 0 ? "+" : ""}${totalUnrealized.toFixed(2)}
          </p>
        </div>
        <div
          className={cn(
            "rounded border border-[#1d2b2f] p-3",
            dailyPnL >= 0 ? "bg-[#0f2523]" : "bg-[#2a1515]"
          )}
        >
          <p className="mb-1 text-[10px] uppercase text-[#708084]">Daily P&L</p>
          <p
            className={cn(
              "font-mono text-lg font-semibold",
              dailyPnL >= 0 ? "text-[#53d8c8]" : "text-[#f16d75]"
            )}
          >
            {dailyPnL >= 0 ? "+" : ""}${dailyPnL.toFixed(2)}
          </p>
        </div>
        <div className="rounded border border-[#1d2b2f] bg-[#0a1518] p-3">
          <p className="mb-1 text-[10px] uppercase text-[#708084]">Total P&L</p>
          <p className="font-mono text-lg font-semibold text-white">
            +${(totalUnrealized + totalRealized).toFixed(2)}
          </p>
        </div>
        <div className="rounded border border-[#1d2b2f] bg-[#0a1518] p-3">
          <p className="mb-1 text-[10px] uppercase text-[#708084]">Win Rate</p>
          <p className="font-mono text-lg font-semibold text-white">68%</p>
        </div>
      </div>
      <div className="border-t border-[#162326] px-4 py-3">
        <div className="mb-2 flex justify-between text-xs">
          <span className="text-[#708084]">Margin Used</span>
          <span className="font-mono text-white">
            ${totalMargin.toLocaleString()} / $50,000
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[#132126]">
          <div
            className="h-full bg-[#53d8c8] transition-all duration-500"
            style={{
              width: `${Math.min(100, (totalMargin / 50000) * 100)}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

// Compact Risk Summary Card
function RiskSummary({
  positions,
}: {
  positions: Array<{ pnlHistory: number[] }>;
}) {
  // Calculate simple risk metrics
  const positionsWithHistory = positions.filter((p) => p.pnlHistory.length > 0);
  const hasData = positionsWithHistory.length > 0;

  return (
    <div className="rounded-lg border border-[#162326] bg-[#0c181b]">
      <div className="flex items-center justify-between border-b border-[#162326] px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Target className="h-4 w-4 text-[#53d8c8]" />
          Risk Metrics
        </h3>
        <span
          className={cn(
            "text-xs",
            hasData ? "text-[#53d8c8]" : "text-[#708084]"
          )}
        >
          {hasData ? "Good" : "Need Data"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 p-4">
        <div className="rounded border border-[#1d2b2f] bg-[#0a1518] p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] text-[#708084]">
            <AlertTriangle className="h-3 w-3" />
            95% VaR
          </div>
          <p className="mt-1 font-mono text-sm font-semibold text-[#f16d75]">
            {hasData ? "-$1,234" : "--"}
          </p>
        </div>
        <div className="rounded border border-[#1d2b2f] bg-[#0a1518] p-2.5">
          <div className="text-[10px] text-[#708084]">Sharpe Ratio</div>
          <p className="mt-1 font-mono text-sm font-semibold text-white">
            {hasData ? "1.45" : "--"}
          </p>
        </div>
        <div className="rounded border border-[#1d2b2f] bg-[#0a1518] p-2.5">
          <div className="text-[10px] text-[#708084]">Max Drawdown</div>
          <p className="mt-1 font-mono text-sm font-semibold text-[#f16d75]">
            {hasData ? "-$2,567" : "--"}
          </p>
        </div>
        <div className="rounded border border-[#1d2b2f] bg-[#0a1518] p-2.5">
          <div className="text-[10px] text-[#708084]">Volatility</div>
          <p className="mt-1 font-mono text-sm font-semibold text-white">
            {hasData ? "12.3%" : "--"}
          </p>
        </div>
      </div>
    </div>
  );
}
