import { TerminalGrid } from "@/components/layout/TerminalGrid";
import { MarketSelector } from "@/components/market-selector/MarketSelector";
import { OrderBook } from "@/components/orderbook/OrderBook";
import { TradeForm } from "@/components/trade-form/TradeForm";
import { TradingChart } from "@/components/chart/TradingChart";
import { RecentTrades } from "@/components/recent-trades/RecentTrades";
import { PositionsTabs } from "@/components/positions/PositionsTabs";

export function TerminalPage() {
  return (
    <TerminalGrid
      marketSelector={<MarketSelector />}
      orderBook={<OrderBook />}
      tradeForm={<TradeForm />}
      chart={<TradingChart />}
      recentTrades={<RecentTrades />}
      positions={<PositionsTabs />}
    />
  );
}
