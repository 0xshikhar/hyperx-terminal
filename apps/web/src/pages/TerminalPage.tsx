import { IncidentConsole } from "@/components/monitoring/IncidentConsole";
import { TerminalGrid } from "@/components/layout/TerminalGrid";
import { MarketSelector } from "@/components/market-selector/MarketSelector";
import { OrderBook } from "@/components/orderbook/OrderBook";
import { TradeForm } from "@/components/trade-form/TradeForm";
import { TradingChart } from "@/components/chart/TradingChart";
import { RecentTrades } from "@/components/recent-trades/RecentTrades";
import { PositionsTabs } from "@/components/positions/PositionsTabs";
import { useVimNavigation } from "@/hooks/useVimNavigation";

export function TerminalPage() {
  useVimNavigation();

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <IncidentConsole compact />
      <div className="min-h-0 flex-1">
        <TerminalGrid
          marketSelector={<MarketSelector />}
          orderBook={<OrderBook />}
          tradeForm={<TradeForm />}
          chart={<TradingChart />}
          recentTrades={<RecentTrades />}
          positions={<PositionsTabs />}
        />
      </div>
    </div>
  );
}
