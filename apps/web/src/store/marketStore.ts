import { create } from "zustand";
import { normalizeMarketSymbol } from "@hyperx/types/common";

export type MarketSnapshot = {
    symbol: string;
    venueSymbol?: string;
    displaySymbol?: string;
    name: string;
    lastPrice: number;
    changePercent24h: number;
    volume24h: number;
    openInterest: number;
    fundingRate: number;
};

type MarketState = {
    activeMarket: string;
    markets: MarketSnapshot[];
    setActiveMarket: (symbol: string) => void;
    setMarkets: (markets: MarketSnapshot[]) => void;
    updateMarket: (symbol: string, data: Partial<MarketSnapshot>) => void;
};

const DEFAULT_MARKETS: MarketSnapshot[] = [
  {
    symbol: "BTC-USD",
    displaySymbol: "BTC-USD",
    venueSymbol: "BTC-USD-PERP",
    name: "Bitcoin",
    lastPrice: 76045.9,
    changePercent24h: 0.92,
    volume24h: 11685149,
    openInterest: 64.8,
    fundingRate: 0.00008,
  },
  {
    symbol: "ETH-USD",
    displaySymbol: "ETH-USD",
    venueSymbol: "ETH-USD-PERP",
    name: "Ethereum",
    lastPrice: 2640.5,
    changePercent24h: 1.15,
    volume24h: 5840200,
    openInterest: 1420.5,
    fundingRate: 0.00005,
  },
  {
    symbol: "HYPE-USD",
    displaySymbol: "HYPE-USD",
    venueSymbol: "HYPE-USD-PERP",
    name: "Hyperliquid",
    lastPrice: 24.8,
    changePercent24h: 3.42,
    volume24h: 2150000,
    openInterest: 85000,
    fundingRate: 0.0001,
  },
  {
    symbol: "SOL-USD",
    displaySymbol: "SOL-USD",
    venueSymbol: "SOL-USD-PERP",
    name: "Solana",
    lastPrice: 188.4,
    changePercent24h: -0.45,
    volume24h: 3410000,
    openInterest: 12400,
    fundingRate: 0.00007,
  },
  {
    symbol: "STRK-USD",
    displaySymbol: "STRK-USD",
    venueSymbol: "STRK-USD-PERP",
    name: "Starknet",
    lastPrice: 0.46,
    changePercent24h: 2.1,
    volume24h: 890000,
    openInterest: 450000,
    fundingRate: 0.00004,
  },
];

export const useMarketStore = create<MarketState>()((set) => ({
    activeMarket: "BTC-USD",
    markets: DEFAULT_MARKETS,
    setActiveMarket: (symbol: string) => set({ activeMarket: normalizeMarketSymbol(symbol) }),
    setMarkets: (markets: MarketSnapshot[]) => {
        const seen = new Set<string>();
        const deduped: MarketSnapshot[] = [];
        for (const m of markets) {
            const sym = normalizeMarketSymbol(m.symbol);
            if (!seen.has(sym)) {
                seen.add(sym);
                deduped.push({
                    ...m,
                    symbol: sym,
                    displaySymbol: m.displaySymbol ?? sym,
                });
            }
        }
        set((state) => ({
            markets: deduped.length > 0 ? deduped : state.markets,
            activeMarket: state.activeMarket || (deduped[0]?.symbol ?? "BTC-USD"),
        }));
    },
    updateMarket: (symbol: string, data: Partial<MarketSnapshot>) =>
        set((state) => {
            const targetSymbol = normalizeMarketSymbol(symbol);
            let matched = false;
            let hasChanged = false;
            const updated = state.markets.map((market) => {
                if (normalizeMarketSymbol(market.symbol) === targetSymbol) {
                    matched = true;
                    const keys = Object.keys(data) as (keyof MarketSnapshot)[];
                    const differs = keys.some(
                      (k) => data[k] !== undefined && data[k] !== market[k]
                    );
                    if (!differs) return market;
                    hasChanged = true;
                    return { ...market, ...data, symbol: targetSymbol };
                }
                return market;
            });
            if (!matched || !hasChanged) return state;
            return { markets: updated };
        }),
}));
