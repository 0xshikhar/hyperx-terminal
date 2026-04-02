import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MarketSelectorModal } from "../MarketSelectorModal";
import { useMarketStore } from "@/store/marketStore";

describe("MarketSelectorModal", () => {
  beforeEach(() => {
    localStorage.clear();
    useMarketStore.setState({
      activeMarket: "BTC-USD",
    });
  });

  it("renders markets list when open", () => {
    render(<MarketSelectorModal open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Select Market")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search markets/i)).toBeInTheDocument();
    expect(screen.getByText("BTC-USD")).toBeInTheDocument();
    expect(screen.getByText("ETH-USD")).toBeInTheDocument();
  });

  it("filters markets based on search input", () => {
    render(<MarketSelectorModal open={true} onOpenChange={vi.fn()} />);

    const searchInput = screen.getByPlaceholderText(/Search markets/i);
    fireEvent.change(searchInput, { target: { value: "ETH" } });

    expect(screen.getByText("ETH-USD")).toBeInTheDocument();
    expect(screen.queryByText("BTC-USD")).not.toBeInTheDocument();
  });

  it("switches category to watchlist and displays favorited pairs", () => {
    render(<MarketSelectorModal open={true} onOpenChange={vi.fn()} />);

    const watchlistBtn = screen.getByText(/^Watchlist/).closest("button")!;
    fireEvent.click(watchlistBtn);

    // Default favorites include BTC-USD and ETH-USD
    expect(screen.getByText("BTC-USD")).toBeInTheDocument();
    expect(screen.getByText("ETH-USD")).toBeInTheDocument();
  });

  it("selects a market and calls onOpenChange(false)", () => {
    const onOpenChange = vi.fn();
    render(<MarketSelectorModal open={true} onOpenChange={onOpenChange} />);

    const ethRow = screen.getByText("ETH-USD");
    fireEvent.click(ethRow);

    expect(useMarketStore.getState().activeMarket).toBe("ETH-USD");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("supports keyboard navigation with arrow keys and Enter", () => {
    const onOpenChange = vi.fn();
    render(<MarketSelectorModal open={true} onOpenChange={onOpenChange} />);

    // Press ArrowDown then Enter
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "Enter" });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
