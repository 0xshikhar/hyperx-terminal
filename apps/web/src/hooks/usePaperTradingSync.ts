import { useEffect, useRef } from "react";
import { useMarketStore } from "@/store/marketStore";
import { usePaperTradingStore } from "@/store/paperTradingStore";
import { useIsPaperTrading } from "./useIsPaperTrading";
import { useRuntimeHealthStore } from "@/store/runtimeHealthStore";

export function usePaperTradingSync() {
  const isPaperTrading = useIsPaperTrading();
  const lastFundingSettlementRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!isPaperTrading) return;

    // Check positions, open orders, and TWAP orders once per second
    const intervalId = setInterval(() => {
      const paperStore = usePaperTradingStore.getState();
      const positions = paperStore.positions;
      const openOrders = paperStore.openOrders;
      const twapOrders = paperStore.twapOrders;

      const markets = useMarketStore.getState().markets;
      const relevantMarkets = new Set<string>();
      for (const p of positions) relevantMarkets.add(p.market);
      for (const o of openOrders) relevantMarkets.add(o.market);
      for (const t of twapOrders) {
        if (t.status === "running") relevantMarkets.add(t.market);
      }

      // Check feed health
      const activeMarket = useMarketStore.getState().activeMarket;
      const feedHealth = useRuntimeHealthStore.getState().getMarketFeedHealth(activeMarket);
      const isFeedStale = !feedHealth.isFresh;

      for (const m of markets) {
        if (!relevantMarkets.has(m.symbol) && m.symbol !== activeMarket) continue;
        let markPrice = m.markPrice || m.lastPrice || 100;

        // If feed is stale or in paper mode without price movement, simulate realistic micro-fluctuations (±0.015%)
        // so open positions show realistic, dynamic PnL instead of frozen 0
        if (isFeedStale && markPrice > 0) {
          const jitterPercent = (Math.random() - 0.49) * 0.0003; // max +/- 0.015%
          const simulatedPrice = Number((markPrice * (1 + jitterPercent)).toFixed(markPrice >= 1000 ? 2 : 4));
          markPrice = simulatedPrice;
          useMarketStore.getState().updateMarket(m.symbol, {
            markPrice: simulatedPrice,
            lastPrice: simulatedPrice,
          });
        }

        if (markPrice > 0) {
          paperStore.onPriceTick(m.symbol, markPrice);
        }

        // Execute scheduled TWAP slices
        const runningTwaps = twapOrders.filter(
          (t) => t.market === m.symbol && t.status === "running" && Date.now() >= t.nextSliceAt
        );
        for (const twap of runningTwaps) {
          paperStore.executeTwapSlice(twap.id, markPrice);
        }
      }

      // Periodic simulated funding rate settlement every 60s in paper trading
      if (Date.now() - lastFundingSettlementRef.current >= 60_000 && positions.length > 0) {
        lastFundingSettlementRef.current = Date.now();
        for (const pos of positions) {
          const m = markets.find((item) => item.symbol === pos.market);
          const rate = m?.fundingRate ?? 0.0001;
          paperStore.settleFundingPeriod(pos.market, rate);
        }
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isPaperTrading]);
}
