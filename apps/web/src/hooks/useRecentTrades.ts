import { useEffect, useMemo } from "react";
import { useTradeStore, type Trade } from "@/store/tradeStore";
import { wsClient } from "@/services/wsClient";

const EMPTY_TRADES: Trade[] = [];

export function useRecentTrades(market: string) {
  const trades = useTradeStore((s) => s.tradesByMarket[market] ?? EMPTY_TRADES);

  useEffect(() => {
    wsClient.subscribe("trades", market);
    return () => wsClient.unsubscribe("trades", market);
  }, [market]);

  const listData = useMemo(() => trades, [trades]);

  return { trades, listData };
}
