import { FixedSizeList, type ListChildComponentProps } from "react-window";
import { useMarketStore } from "@/store/marketStore";
import { RecentTradeRow } from "@/components/recent-trades/RecentTradeRow";
import { useRecentTrades } from "@/hooks/useRecentTrades";
import { useRuntimeHealthStore } from "@/store/runtimeHealthStore";

export function RecentTrades() {
  const activeMarket = useMarketStore((s) => s.activeMarket);
  const { trades, listData } = useRecentTrades(activeMarket);
  const connectionState = useRuntimeHealthStore((state) => state.connectionState);
  const getMarketFeedHealth = useRuntimeHealthStore((state) => state.getMarketFeedHealth);
  const feedHealth = getMarketFeedHealth(activeMarket);

  const Row = ({ index, style, data }: ListChildComponentProps<typeof listData>) => {
    const trade = data[index];
    return (
      <div style={style}>
        <RecentTradeRow
          side={trade.side}
          price={trade.price}
          size={trade.size}
          timestamp={trade.timestamp}
          time={trade.time}
        />
      </div>
    );
  };

  return (
    <div className="h-full rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Recent Trades</h3>
        <span className="text-xs text-muted-foreground">{activeMarket}</span>
      </div>
      <div className="mt-3">
        {trades.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-xs text-muted-foreground">
            {connectionState === "connected"
              ? "Waiting for the first live trades on this market…"
              : "Trade tape paused while the live connection recovers."}
          </div>
        ) : !feedHealth.isFresh ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 px-6 text-center text-xs text-muted-foreground">
            <div>Recent trade tape is stale for {activeMarket}.</div>
            <div>
              The socket is {connectionState === "connected" ? "up but quiet" : connectionState}, so the list is showing the last known snapshot instead of pretending it is live.
            </div>
          </div>
        ) : (
          <FixedSizeList
            height={256}
            width="100%"
            itemCount={trades.length}
            itemSize={32}
            itemData={listData}
          >
            {Row}
          </FixedSizeList>
        )}
      </div>
    </div>
  );
}
