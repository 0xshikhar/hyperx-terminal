import { useEffect, useMemo } from "react";
import { useTradeStore, type Trade } from "@/store/tradeStore";
import { wsClient } from "@/services/wsClient";
import { normalizeMarketSymbol } from "@hyperx/types/common";

import { useNetworkStore } from "@/store/networkStore";

const EMPTY_TRADES: Trade[] = [];

export function useRecentTrades(market: string) {
  const normalizedMarket = useMemo(() => normalizeMarketSymbol(market), [market]);
  const network = useNetworkStore((s) => s.network);
  const trades = useTradeStore((s) => s.tradesByMarket[normalizedMarket] ?? EMPTY_TRADES);

  useEffect(() => {
    wsClient.subscribe("trades", normalizedMarket, network);
    return () => wsClient.unsubscribe("trades", normalizedMarket, network);
  }, [normalizedMarket, network]);

  return { trades, listData: trades, isReference: false };
}
