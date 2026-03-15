import { useEffect, useMemo } from "react";
import { createReferenceTrades } from "@/lib/mockMarketData";
import { useMarketStore } from "@/store/marketStore";
import { useTradeStore, type Trade } from "@/store/tradeStore";
import { wsClient } from "@/services/wsClient";
import { normalizeMarketSymbol } from "@hyperx/types/common";

const EMPTY_TRADES: Trade[] = [];

export function useRecentTrades(market: string) {
  const normalizedMarket = useMemo(() => normalizeMarketSymbol(market), [market]);
  const trades = useTradeStore((s) => s.tradesByMarket[normalizedMarket] ?? EMPTY_TRADES);
  const marketSnapshot = useMarketStore((state) =>
    state.markets.find((entry) => entry.symbol === normalizedMarket)
  );

  useEffect(() => {
    wsClient.subscribe("trades", normalizedMarket);
    return () => wsClient.unsubscribe("trades", normalizedMarket);
  }, [normalizedMarket]);

  const referenceTrades = useMemo(
    () => createReferenceTrades(normalizedMarket, marketSnapshot?.lastPrice ?? 100),
    [normalizedMarket, marketSnapshot?.lastPrice]
  );
  const listData = useMemo(() => (trades.length > 0 ? trades : referenceTrades), [referenceTrades, trades]);

  return { trades: listData, listData, isReference: trades.length === 0 };
}
