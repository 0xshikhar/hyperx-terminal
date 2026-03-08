import { wsClient } from "@/services/wsClient";
import { listMarkets } from "@/services/apiClient/markets.api";
import { isAuthenticated } from "@/services/auth.service";
import { useMarketStore } from "@/store/marketStore";
import { useOrderbookStore } from "@/store/orderbookStore";
import { useOrdersStore } from "@/store/ordersStore";
import { usePositionsStore } from "@/store/positionsStore";
import { useTradeStore } from "@/store/tradeStore";

let started = false;

export function startClientServices() {
  if (started) return;
  started = true;

  void hydrateMarkets();

  wsClient.on("ticker", (message) => {
    useMarketStore.getState().updateMarket(message.market, {
      lastPrice: message.lastPrice,
      changePercent24h: message.changePercent24h,
      volume24h: message.volume24h,
      openInterest: message.openInterest,
      fundingRate: message.fundingRate,
    });
  });

  wsClient.on("orderbook", (message) => {
    useOrderbookStore.getState().queueBatch({
      market: message.market,
      bids: message.bids,
      asks: message.asks,
      timestamp: message.timestamp,
    });
  });

  wsClient.on("trades", (message) => {
    useTradeStore.getState().addTrades(message.market, message.trades);
  });

  wsClient.connect();

  if (isAuthenticated()) {
    void usePositionsStore.getState().fetchPositions();
    void useOrdersStore.getState().fetchOrders();
  }
}

async function hydrateMarkets() {
  try {
    const existing = useMarketStore.getState().markets;
    const existingBySymbol = new Map(existing.map((market) => [market.symbol, market]));
    const markets = await listMarkets();
    const normalized = markets.map((market) => {
      const snapshot = existingBySymbol.get(market.symbol);
      return {
        symbol: market.symbol,
        name: market.name,
        lastPrice: market.lastPrice ?? snapshot?.lastPrice ?? 0,
        changePercent24h: market.changePercent24h ?? snapshot?.changePercent24h ?? 0,
        volume24h: market.volume24h ?? snapshot?.volume24h ?? 0,
        openInterest: market.openInterest ?? snapshot?.openInterest ?? 0,
        fundingRate: market.fundingRate ?? snapshot?.fundingRate ?? 0,
      };
    });
    if (normalized.length > 0) {
      useMarketStore.getState().setMarkets(normalized);
    }
  } catch {
    // Keep seeded local snapshots when API market bootstrap fails.
  }
}
