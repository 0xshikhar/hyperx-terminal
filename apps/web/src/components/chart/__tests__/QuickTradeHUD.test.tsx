import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuickTradeHUD } from "../QuickTradeHUD";
import { usePaperTradingStore } from "@/store/paperTradingStore";

vi.mock("@/store/marketStore", () => ({
  useMarketStore: (selector: (state: any) => any) =>
    selector({
      markets: [
        { symbol: "BTC-USD-PERP", lastPrice: 76000 },
      ],
      activeMarket: "BTC-USD-PERP",
    }),
}));

vi.mock("@/hooks/useOrderBook", () => ({
  useOrderBook: () => ({
    aggregatedBids: [{ price: 75990, size: 1.5 }],
    aggregatedAsks: [{ price: 76010, size: 2.0 }],
  }),
}));

describe("QuickTradeHUD", () => {
  beforeEach(() => {
    usePaperTradingStore.getState().resetAccount();
    localStorage.clear();
  });

  it("renders Quick Scalp HUD with sell and buy execution buttons", () => {
    render(<QuickTradeHUD market="BTC-USD-PERP" />);

    expect(screen.getByText("QUICK SCALP")).toBeInTheDocument();
    expect(screen.getByText("SELL / SHORT")).toBeInTheDocument();
    expect(screen.getByText("BUY / LONG")).toBeInTheDocument();
  });

  it("executes market buy order on 1-click buy button", () => {
    render(<QuickTradeHUD market="BTC-USD-PERP" />);

    const buyBtn = screen.getByText("BUY / LONG").closest("button");
    expect(buyBtn).toBeDefined();

    fireEvent.click(buyBtn!);

    const pos = usePaperTradingStore.getState().positions.find((p) => p.market === "BTC-USD-PERP");
    expect(pos).toBeDefined();
    expect(pos?.side).toBe("long");
    expect(pos?.size).toBe(0.1);
  });

  it("executes market sell order on 1-click sell button", () => {
    render(<QuickTradeHUD market="BTC-USD-PERP" />);

    const sellBtn = screen.getByText("SELL / SHORT").closest("button");
    expect(sellBtn).toBeDefined();

    fireEvent.click(sellBtn!);

    const pos = usePaperTradingStore.getState().positions.find((p) => p.market === "BTC-USD-PERP");
    expect(pos).toBeDefined();
    expect(pos?.side).toBe("short");
    expect(pos?.size).toBe(0.1);
  });
});
