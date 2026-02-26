import { wsClient } from "@/services/wsClient";
import { useMarketStore } from "@/store/marketStore";
import { useOrderbookStore } from "@/store/orderbookStore";
import { useTradeStore } from "@/store/tradeStore";

let started = false;

export function startClientServices() {
  if (started) return;
  started = true;

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
}
