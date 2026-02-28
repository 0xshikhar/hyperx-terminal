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

export const useMarketStore = create<MarketState>()((set) => ({
    activeMarket: "",
    markets: [],
    setActiveMarket: (symbol: string) => set({ activeMarket: normalizeMarketSymbol(symbol) }),
    setMarkets: (markets: MarketSnapshot[]) => set({ markets }),
    updateMarket: (symbol: string, data: Partial<MarketSnapshot>) =>
        set((state) => ({
            markets: state.markets.map((market) =>
                normalizeMarketSymbol(market.symbol) === normalizeMarketSymbol(symbol)
                    ? { ...market, ...data, symbol: normalizeMarketSymbol(market.symbol) }
                    : market
            ),
        })),
}));
