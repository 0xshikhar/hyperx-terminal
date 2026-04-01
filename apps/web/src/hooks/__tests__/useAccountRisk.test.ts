import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAccountRisk } from "../useAccountRisk";
import { usePaperTradingStore } from "@/store/paperTradingStore";
import { useNetworkStore } from "@/store/networkStore";

// Mock react-query
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: null,
    isLoading: false,
    isError: false,
  }),
}));

describe("useAccountRisk Hook", () => {
  beforeEach(() => {
    useNetworkStore.setState({ isPaperTrading: true });
    usePaperTradingStore.setState({
      balance: 10000,
      positions: [],
      openOrders: [],
    });
  });

  it("returns 0% margin ratio and healthy tier when no positions are open", () => {
    const { result } = renderHook(() => useAccountRisk());

    expect(result.current.marginRatio).toBe(0);
    expect(result.current.riskTier).toBe("healthy");
    expect(result.current.adlPriority).toBe(0);
    expect(result.current.hasOpenPositions).toBe(false);
  });

  it("calculates healthy margin ratio when positions have low margin requirement (<50%)", () => {
    // 10,000 cash, 1,000 margin used => equity = 11,000, maintenance margin = 500 => margin ratio = 500 / 11,000 = ~4.5%
    usePaperTradingStore.setState({
      balance: 10000,
      positions: [
        {
          id: "pos-1",
          market: "BTC-USD",
          side: "long",
          size: 0.1,
          entryPrice: 60000,
          markPrice: 60000,
          margin: 1000,
          leverage: 10,
          openedAt: new Date().toISOString(),
          pnl: 0,
          pnlPercent: 0,
        },
      ],
    });

    const { result } = renderHook(() => useAccountRisk());

    expect(result.current.marginRatio).toBeGreaterThan(0);
    expect(result.current.marginRatio).toBeLessThan(50);
    expect(result.current.riskTier).toBe("healthy");
    expect(result.current.adlPriority).toBe(1); // 1 light bar for active position with 0 pnl
    expect(result.current.hasOpenPositions).toBe(true);
  });

  it("identifies caution tier when margin ratio is between 50% and 80%", () => {
    // High margin used relative to remaining balance
    // balance: 500, margin: 5000, pnl: -1500 => equity = 500 + 5000 - 1500 = 4000
    // maintenance margin = 2500 => margin ratio = (2500 / 4000) * 100 = 62.5% (caution tier)
    usePaperTradingStore.setState({
      balance: 500,
      positions: [
        {
          id: "pos-2",
          market: "BTC-USD",
          side: "long",
          size: 1,
          entryPrice: 50000,
          markPrice: 48500,
          margin: 5000,
          leverage: 10,
          openedAt: new Date().toISOString(),
          pnl: -1500,
          pnlPercent: -30,
        },
      ],
    });

    const { result } = renderHook(() => useAccountRisk());

    expect(result.current.marginRatio).toBeGreaterThanOrEqual(50);
    expect(result.current.marginRatio).toBeLessThan(80);
    expect(result.current.riskTier).toBe("caution");
  });

  it("identifies danger tier when margin ratio exceeds 80%", () => {
    // balance: 100, margin: 5000, pnl: -2000 => equity = 3100
    // maintenance margin = 2500 => margin ratio = (2500 / 3100) * 100 = 80.6% (danger tier)
    usePaperTradingStore.setState({
      balance: 100,
      positions: [
        {
          id: "pos-3",
          market: "BTC-USD",
          side: "long",
          size: 1,
          entryPrice: 50000,
          markPrice: 48000,
          margin: 5000,
          leverage: 10,
          openedAt: new Date().toISOString(),
          pnl: -2000,
          pnlPercent: -40,
        },
      ],
    });

    const { result } = renderHook(() => useAccountRisk());

    expect(result.current.marginRatio).toBeGreaterThanOrEqual(80);
    expect(result.current.riskTier).toBe("danger");
  });

  it("calculates high ADL priority queue rank for highly profitable leveraged positions", () => {
    // Position with +100% PnL and 20x leverage => rank = 100 * 20 = 2000 > 800 => priority 5
    usePaperTradingStore.setState({
      balance: 10000,
      positions: [
        {
          id: "pos-4",
          market: "BTC-USD",
          side: "long",
          size: 0.5,
          entryPrice: 50000,
          markPrice: 60000,
          margin: 1250,
          leverage: 20,
          openedAt: new Date().toISOString(),
          pnl: 5000,
          pnlPercent: 400,
        },
      ],
    });

    const { result } = renderHook(() => useAccountRisk());
    expect(result.current.adlPriority).toBe(5);
  });
});
