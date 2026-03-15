import { FixedSizeList, type ListChildComponentProps } from "react-window";
import { useMarketStore } from "@/store/marketStore";
import { RecentTradeRow } from "@/components/recent-trades/RecentTradeRow";
import { useRecentTrades } from "@/hooks/useRecentTrades";
import { useRuntimeHealthStore } from "@/store/runtimeHealthStore";
import { cn } from "@/lib/utils";

type RecentTradesProps = {
  embedded?: boolean;
};

export function RecentTrades({ embedded = false }: RecentTradesProps) {
  const activeMarket = useMarketStore((s) => s.activeMarket);
  const { trades, listData, isReference } = useRecentTrades(activeMarket);
  const connectionState = useRuntimeHealthStore((state) => state.connectionState);
  const getMarketFeedHealth = useRuntimeHealthStore((state) => state.getMarketFeedHealth);
  const feedHealth = getMarketFeedHealth(activeMarket);
  const listHeight = embedded ? 420 : 256;

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
    <div
      className={cn(
        "flex h-full min-h-0 flex-col",
        embedded
          ? "bg-[#091416]"
          : "rounded-[20px] border border-border/70 bg-[linear-gradient(180deg,rgba(17,17,24,0.98),rgba(10,10,15,0.98))] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.28)]"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between",
          embedded ? "border-b border-[#152327] px-4 py-3" : ""
        )}
      >
        {!embedded ? <h3 className="text-sm font-semibold">Recent Trades</h3> : <div className="text-xs font-medium text-[#8da0a4]">Tape</div>}
        <span className={cn("text-xs", embedded ? "text-[#8da0a4]" : "text-muted-foreground")}>
          {activeMarket}
          {isReference && " · reference"}
        </span>
      </div>
      <div className={cn("min-h-0 flex-1", embedded ? "px-4 py-3" : "mt-3")}>
        {isReference ? (
          <div className="space-y-3">
            <div className="rounded-md border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-xs text-sky-200">
              Live trade prints are unavailable, so the tape is rendering a deterministic reference sequence for {activeMarket}.
            </div>
            <FixedSizeList
              height={listHeight}
              width="100%"
              itemCount={trades.length}
              itemSize={32}
              itemData={listData}
            >
              {Row}
            </FixedSizeList>
          </div>
        ) : !feedHealth.isFresh ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 px-6 text-center text-xs text-muted-foreground">
            <div>
              Recent trade tape is stale for {activeMarket}.
            </div>
            <div>
              The socket is {connectionState === "connected" ? "up but quiet" : connectionState}, so the list is showing the last known snapshot instead of pretending it is live.
            </div>
          </div>
        ) : (
          <FixedSizeList
            height={listHeight}
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
