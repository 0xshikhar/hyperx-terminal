import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecentTrades } from "../RecentTrades";

vi.mock("@/store/marketStore", () => ({
  useMarketStore: (selector: (state: { activeMarket: string }) => unknown) =>
    selector({ activeMarket: "BTC-USD" }),
}));

vi.mock("@/store/runtimeHealthStore", () => ({
  useRuntimeHealthStore: (
    selector: (state: {
      connectionState: string;
      getMarketFeedHealth: () => { isFresh: boolean };
    }) => unknown
  ) =>
    selector({
      connectionState: "connected",
      getMarketFeedHealth: () => ({ isFresh: true }),
    }),
}));

vi.mock("@/hooks/useRecentTrades", () => ({
  useRecentTrades: () => ({
    trades: [
      {
        id: "t1",
        market: "BTC-USD",
        side: "buy",
        price: 76500,
        size: 0.25,
        timestamp: 1710000000000,
        time: "12:00:00",
      },
      {
        id: "t2",
        market: "BTC-USD",
        side: "sell",
        price: 76495,
        size: 1.1,
        timestamp: 1710000001000,
        time: "12:00:01",
      },
    ],
    listData: [
      {
        id: "t1",
        market: "BTC-USD",
        side: "buy",
        price: 76500,
        size: 0.25,
        timestamp: 1710000000000,
        time: "12:00:00",
      },
      {
        id: "t2",
        market: "BTC-USD",
        side: "sell",
        price: 76495,
        size: 1.1,
        timestamp: 1710000001000,
        time: "12:00:01",
      },
    ],
    isReference: false,
  }),
}));

describe("RecentTrades", () => {
  it("renders heading and active market", () => {
    render(<RecentTrades />);
    expect(screen.getByText("Recent Trades")).toBeInTheDocument();
    expect(screen.getByText("BTC-USD")).toBeInTheDocument();
  });

  it("renders embedded layout heading", () => {
    render(<RecentTrades embedded />);
    expect(screen.getByText("Tape")).toBeInTheDocument();
  });

  it("renders trade rows with correct price formatting", () => {
    render(<RecentTrades />);
    expect(screen.getByText("76,500")).toBeInTheDocument();
    expect(screen.getByText("76,495")).toBeInTheDocument();
    expect(screen.getByText("0.2500")).toBeInTheDocument();
    expect(screen.getByText("1.1000")).toBeInTheDocument();
  });
});
