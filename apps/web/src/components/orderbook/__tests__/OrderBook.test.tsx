import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OrderBook } from "../OrderBook";

// Mock data
const mockBids = [
  { price: 95000, size: 1.5, total: 1.5 },
  { price: 94950, size: 2.0, total: 3.5 },
  { price: 94900, size: 1.0, total: 4.5 },
];

const mockAsks = [
  { price: 95100, size: 0.5, total: 0.5 },
  { price: 95150, size: 1.2, total: 1.7 },
  { price: 95200, size: 0.8, total: 2.5 },
];

// Mock the store
vi.mock("@/store/marketStore", () => ({
  useMarketStore: () => ({
    orderbook: {
      bids: mockBids,
      asks: mockAsks,
      lastUpdateId: 12345,
    },
    selectedMarket: "BTC-USD",
  }),
}));

describe("OrderBook", () => {
  it("renders bids and asks sections", () => {
    render(<OrderBook market="BTC-USD" />);

    expect(screen.getByText(/bids/i)).toBeInTheDocument();
    expect(screen.getByText(/asks/i)).toBeInTheDocument();
  });

  it("displays orderbook data correctly", () => {
    render(<OrderBook market="BTC-USD" />);

    // Check for bid prices
    expect(screen.getByText("95000.00")).toBeInTheDocument();
    expect(screen.getByText("94950.00")).toBeInTheDocument();

    // Check for ask prices
    expect(screen.getByText("95100.00")).toBeInTheDocument();
    expect(screen.getByText("95150.00")).toBeInTheDocument();
  });

  it("calls onPriceClick when a price is clicked", () => {
    const handlePriceClick = vi.fn();
    render(<OrderBook market="BTC-USD" onPriceClick={handlePriceClick} />);

    const priceElement = screen.getByText("95000.00");
    fireEvent.click(priceElement);

    expect(handlePriceClick).toHaveBeenCalledWith(95000, "bid");
  });

  it("shows spread information", () => {
    render(<OrderBook market="BTC-USD" />);

    // Spread should be shown (95100 - 95000 = 100)
    expect(screen.getByText(/spread/i)).toBeInTheDocument();
  });
});
