import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
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

  it("renders 3 column headers with active base symbol", () => {
    render(<OrderBook />);
    expect(screen.getByText("Price")).toBeInTheDocument();
    expect(screen.getByText("Size (BTC)")).toBeInTheDocument();
    expect(screen.getByText("Total (BTC)")).toBeInTheDocument();
  });

  it("renders 3-way view mode switcher and toggles mode", () => {
    render(<OrderBook />);
    const bothBtn = screen.getByTitle("Both Asks and Bids");
    const bidsBtn = screen.getByTitle("Bids Only");
    const asksBtn = screen.getByTitle("Asks Only");

    expect(bothBtn).toBeInTheDocument();
    expect(bidsBtn).toBeInTheDocument();
    expect(asksBtn).toBeInTheDocument();

    // Toggle to bids only
    act(() => {
      bidsBtn.click();
    });
    // Toggle to asks only
    act(() => {
      asksBtn.click();
    });
  });

  it("renders Book and Depth tab switcher and toggles to Depth chart", () => {
    render(<OrderBook />);
    const bookTab = screen.getByRole("button", { name: "Book" });
    const depthTab = screen.getByRole("button", { name: "Depth" });

    expect(bookTab).toBeInTheDocument();
    expect(depthTab).toBeInTheDocument();

    // Click Depth tab
    act(() => {
      depthTab.click();
    });

    expect(screen.getByTestId("depth-chart-container")).toBeInTheDocument();
  });
});
