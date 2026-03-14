import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrderBook } from "../OrderBook";

vi.mock("@/store/marketStore", () => ({
  useMarketStore: (selector: (state: {
    activeMarket: string;
    markets: { symbol: string }[];
  }) => unknown) =>
    selector({
      activeMarket: "BTC-USD",
      markets: [{ symbol: "BTC-USD" }],
    }),
}));

vi.mock("@/hooks/useOrderBook", () => ({
  useOrderBook: () => ({
    aggregation: 1,
    setAggregation: vi.fn(),
    aggregatedBids: [{ price: 95000, size: 1.5, total: 1.5 }],
    aggregatedAsks: [{ price: 95100, size: 0.5, total: 0.5 }],
    bidRows: [{ price: 95000, size: 1.5, total: 1.5, depthPercent: 100 }],
    askRows: [{ price: 95100, size: 0.5, total: 0.5, depthPercent: 100 }],
  }),
}));

describe("OrderBook", () => {
  it("renders heading and active market", () => {
    render(<OrderBook />);
    expect(screen.getByText("Order Book")).toBeInTheDocument();
    expect(screen.getByText("BTC-USD")).toBeInTheDocument();
  });

  it("renders aggregation selector values", () => {
    render(<OrderBook />);
    expect(screen.getByDisplayValue("1")).toBeInTheDocument();
  });
});
