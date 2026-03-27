import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { normalizeMarketSymbol } from "@hyperx/types/common";

export type MarketSnapshot = {
    symbol: string;
    venueSymbol?: string;
    displaySymbol?: string;
    name: string;
    lastPrice: number;
    markPrice?: number;
    oraclePrice?: number;
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
    lastPrice: 76400.0,
    markPrice: 76400.0,
    oraclePrice: 76380.0,
    changePercent24h: 1.25,
    volume24h: 133797251,
    openInterest: 50.3,
    fundingRate: 0.000086,
  },
  {
    symbol: "ETH-USD",
    displaySymbol: "ETH-USD",
    venueSymbol: "ETH-USD-PERP",
    name: "Ethereum",
    lastPrice: 2440.0,
    markPrice: 2440.0,
    oraclePrice: 2439.0,
    changePercent24h: 2.15,
    volume24h: 6783600,
    openInterest: 567.8,
    fundingRate: 0.000077,
  },
  {
    symbol: "HYPE-USD",
    displaySymbol: "HYPE-USD",
    venueSymbol: "HYPE-USD-PERP",
    name: "Hyperliquid",
    lastPrice: 79.5,
    markPrice: 79.5,
    oraclePrice: 79.4,
    changePercent24h: 3.45,
    volume24h: 3821637,
    openInterest: 3512.9,
    fundingRate: 0.000099,
  },
  {
    symbol: "SOL-USD",
    displaySymbol: "SOL-USD",
    venueSymbol: "SOL-USD-PERP",
    name: "Solana",
    lastPrice: 100.0,
    markPrice: 100.0,
    oraclePrice: 99.95,
    changePercent24h: 3.42,
    volume24h: 20025827,
    openInterest: 8171.0,
    fundingRate: 0.000026,
  },
  {
    symbol: "STRK-USD",
    displaySymbol: "STRK-USD",
    venueSymbol: "STRK-USD-PERP",
    name: "Starknet",
    lastPrice: 0.04,
    markPrice: 0.04,
    oraclePrice: 0.04,
    changePercent24h: 4.88,
    volume24h: 643949,
    openInterest: 125799.8,
    fundingRate: 0.000099,
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

export function useActiveMarket(): string {
  return useMarketStore((s) => s.activeMarket);
}

export function useSetActiveMarket(): (symbol: string) => void {
  return useMarketStore((s) => s.setActiveMarket);
}

export function useActiveMarketSummary(targetSymbol?: string) {
  return useMarketStore(
    useShallow((s) => {
      const sym = targetSymbol || s.activeMarket;
      const m = s.markets.find((item) => item.symbol === sym) ?? s.markets[0];
      const change24h = m?.changePercent24h ?? 0;
      return {
        symbol: sym,
        displaySymbol: m?.displaySymbol ?? m?.symbol ?? sym,
        lastPrice: m?.lastPrice ?? 0,
        changePercent24h: change24h,
        isPositive: change24h >= 0,
      };
    })
  );
}

export function useActiveMarketStats(targetSymbol?: string) {
  return useMarketStore(
    useShallow((s) => {
      const sym = targetSymbol || s.activeMarket;
      const m = s.markets.find((item) => item.symbol === sym) ?? s.markets[0];
      const displayPrice = m?.lastPrice ?? 0;
      const change24h = m?.changePercent24h ?? 0;
      return {
        displayPrice,
        markPrice: m?.markPrice ?? displayPrice,
        oraclePrice: m?.oraclePrice ?? displayPrice,
        changePercent24h: change24h,
        isPositive: change24h >= 0,
        volume24h: m?.volume24h ?? 0,
        openInterest: m?.openInterest ?? 0,
        fundingRate: m?.fundingRate ?? 0,
      };
    })
  );
}

export function useMarketSymbols(): string[] {
  return useMarketStore(
    useShallow((s) => s.markets.map((m) => m.symbol))
  );
}
