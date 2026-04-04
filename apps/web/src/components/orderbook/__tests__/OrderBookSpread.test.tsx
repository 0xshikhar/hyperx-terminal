import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OrderBookSpread } from "../OrderBookSpread";
import * as terminalActions from "@/lib/terminalActions";

const mockDispatch = vi.spyOn(terminalActions, "dispatchTerminalAction").mockImplementation(() => {});

let mockActiveMarket = "BTC-USD";
let mockMarkets = [
  {
    symbol: "BTC-USD",
    lastPrice: 76500.5,
    markPrice: 76500.0,
    changePercent24h: 2.5,
  },
];

vi.mock("@/store/marketStore", () => ({
  useMarketStore: (selector: (state: any) => unknown) =>
    selector({
      activeMarket: mockActiveMarket,
      markets: mockMarkets,
    }),
}));

vi.mock("@/lib/terminalAudio", () => ({
  terminalAudio: {
    playClick: vi.fn(),
  },
}));

describe("OrderBookSpread", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders mid-market last price formatted correctly", () => {
    render(
      <OrderBookSpread
        bids={[{ price: 76500, size: 1.5 }]}
        asks={[{ price: 76501, size: 2.0 }]}
      />
    );

    expect(screen.getByText("$76,500.50")).toBeInTheDocument();
  });

  it("calculates and renders spread in USD and basis points (bps)", () => {
    render(
      <OrderBookSpread
        bids={[{ price: 76500, size: 1.5 }]}
        asks={[{ price: 76501, size: 2.0 }]}
      />
    );

    expect(screen.getByText("$1.00")).toBeInTheDocument();
    expect(screen.getByText(/bps/i)).toBeInTheDocument();
  });

  it("dispatches set-order-price when clicking the last price ticker", () => {
    render(
      <OrderBookSpread
        bids={[{ price: 76500, size: 1.5 }]}
        asks={[{ price: 76501, size: 2.0 }]}
      />
    );

    const priceButton = screen.getByTitle(/Last Fill Price/i);
    fireEvent.click(priceButton);

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "set-order-price",
      price: 76500.5,
    });
  });
});
