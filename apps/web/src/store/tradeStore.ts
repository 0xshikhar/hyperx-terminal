import { create } from "zustand";

export type Trade = {
  id: string;
  market: string;
  side: "buy" | "sell";
  price: number;
  size: number;
  timestamp: number;
  time: string;
};

export type IncomingTrade = Omit<Trade, "market" | "time">;

type TradeState = {
  tradesByMarket: Record<string, Trade[]>;
  maxTrades: number;
  addTrades: (market: string, trades: IncomingTrade[]) => void;
  clearMarket: (market: string) => void;
};

export const useTradeStore = create<TradeState>()((set, get) => ({
  tradesByMarket: {},
  maxTrades: 100,
  addTrades: (market, trades) => {
    const maxTrades = get().maxTrades;
    set((state) => {
      const existing = state.tradesByMarket[market] ?? [];
      const normalized = trades.map((trade) => ({
        ...trade,
        market,
        time: new Date(trade.timestamp).toLocaleTimeString(),
      }));
      const combined = [...normalized, ...existing].slice(0, maxTrades);
      return { tradesByMarket: { ...state.tradesByMarket, [market]: combined } };
    });
  },
  clearMarket: (market) =>
    set((state) => ({
      tradesByMarket: { ...state.tradesByMarket, [market]: [] },
    })),
}));
