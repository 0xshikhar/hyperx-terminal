import { wsClient } from "@/services/wsClient";
import { listMarkets } from "@/services/apiClient/markets.api";
import { isAuthenticated } from "@/services/auth.service";
import { useMarketStore } from "@/store/marketStore";
import { useOrderbookStore } from "@/store/orderbookStore";
import { useOrdersStore } from "@/store/ordersStore";
import { usePositionsStore } from "@/store/positionsStore";
import { useRuntimeHealthStore } from "@/store/runtimeHealthStore";
import { useTradeStore } from "@/store/tradeStore";
import { normalizeMarketSymbol } from "@hyperx/types/common";

let started = false;

export function startClientServices() {
  if (started) return;
  started = true;

  void hydrateMarkets();

  let lastConnectionState = wsClient.connectionState;
  useRuntimeHealthStore.getState().setConnectionState(lastConnectionState);

  wsClient.onConnectionEvent((event) => {
    useRuntimeHealthStore.getState().recordConnectionEvent(event);
  });

  wsClient.onStateChange((nextState) => {
    useRuntimeHealthStore.getState().setConnectionState(nextState);
    lastConnectionState = nextState;
  });

  wsClient.on("ticker", (message) => {
    useRuntimeHealthStore.getState().recordFeedEvent(message.market, "ticker", message.timestamp);
    useMarketStore.getState().updateMarket(message.market, {
      lastPrice: message.lastPrice,
      changePercent24h: message.changePercent24h,
      volume24h: message.volume24h,
      openInterest: message.openInterest,
      fundingRate: message.fundingRate,
    });
  });

  wsClient.on("orderbook", (message) => {
    useRuntimeHealthStore.getState().recordFeedEvent(message.market, "orderbook", message.timestamp);
    useOrderbookStore.getState().queueBatch({
      market: message.market,
      bids: message.bids,
      asks: message.asks,
      timestamp: message.timestamp,
    });
  });

  wsClient.on("trades", (message) => {
    useRuntimeHealthStore.getState().recordFeedEvent(message.market, "trades", message.timestamp);
    useTradeStore.getState().addTrades(message.market, message.trades);
  });

  wsClient.on("pong", () => {
    useRuntimeHealthStore.getState().recordPong();
  });

  wsClient.on("status", (message) => {
    useRuntimeHealthStore.getState().recordFeedEvent("status", "status", message.timestamp);
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
    const existingBySymbol = new Map(
      existing.map((market) => [normalizeMarketSymbol(market.symbol), market])
    );
    const markets = await listMarkets();
    const normalized = markets.map((market) => {
      const snapshot = existingBySymbol.get(market.symbol);
      const symbol = normalizeMarketSymbol(market.symbol);
      return {
        symbol,
        venueSymbol: market.venueSymbol,
        displaySymbol: market.displaySymbol,
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
