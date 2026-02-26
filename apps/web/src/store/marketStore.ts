import { create } from "zustand";

export type MarketSnapshot = {
    symbol: string;
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

const initialMarkets: MarketSnapshot[] = [
    {
        symbol: "BTC-USD",
        name: "Bitcoin",
        lastPrice: 95432.25,
        changePercent24h: 2.14,
        volume24h: 1284500000,
        openInterest: 482000000,
        fundingRate: 0.0125,
    },
    {
        symbol: "ETH-USD",
        name: "Ethereum",
        lastPrice: 4871.1,
        changePercent24h: -1.02,
        volume24h: 842000000,
        openInterest: 246000000,
        fundingRate: 0.0091,
    },
    {
        symbol: "STRK-USD",
        name: "StarkNet",
        lastPrice: 2.41,
        changePercent24h: 5.42,
        volume24h: 112000000,
        openInterest: 42000000,
        fundingRate: 0.021,
    },
];

export const useMarketStore = create<MarketState>()((set) => ({
    activeMarket: initialMarkets[0].symbol,
    markets: initialMarkets,
    setActiveMarket: (symbol: string) => set({ activeMarket: symbol }),
    setMarkets: (markets: MarketSnapshot[]) => set({ markets }),
    updateMarket: (symbol: string, data: Partial<MarketSnapshot>) =>
        set((state) => ({
            markets: state.markets.map((market) =>
                market.symbol === symbol ? { ...market, ...data } : market
            ),
        })),
}));
