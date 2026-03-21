import { useEffect } from "react";
import { useMarketStore } from "@/store/marketStore";
import { usePaperTradingStore } from "@/store/paperTradingStore";
import { useNetworkStore } from "@/store/networkStore";
import { useWallet } from "@/components/wallet/useWallet";

export function usePaperTradingSync() {
  const isNetworkPaper = useNetworkStore((s) => s.isPaperTrading);
  const isPaperWallet = useWallet((s) => s.isPaperWallet);
  const isPaperTrading = isNetworkPaper || isPaperWallet;

  useEffect(() => {
    if (!isPaperTrading) return;

    // Check positions and open orders once per second to avoid freezing main thread
    const intervalId = setInterval(() => {
      const paperStore = usePaperTradingStore.getState();
      const positions = paperStore.positions;
      const openOrders = paperStore.openOrders;

      if (positions.length === 0 && openOrders.length === 0) return;

      const markets = useMarketStore.getState().markets;
      const relevantMarkets = new Set<string>();
      for (const p of positions) relevantMarkets.add(p.market);
      for (const o of openOrders) relevantMarkets.add(o.market);

      for (const m of markets) {
        if (relevantMarkets.has(m.symbol) && m.lastPrice && m.lastPrice > 0) {
          paperStore.onPriceTick(m.symbol, m.lastPrice);
        }
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isPaperTrading]);
}

