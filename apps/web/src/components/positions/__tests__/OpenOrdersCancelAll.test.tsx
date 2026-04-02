import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OpenOrdersTable } from "../OpenOrdersTable";
import { usePaperTradingStore } from "@/store/paperTradingStore";

describe("OpenOrdersTable Cancel All Panic Action", () => {
  beforeEach(() => {
    usePaperTradingStore.getState().resetAccount();
  });

  it("renders disabled Cancel All Orders button when no working orders exist", () => {
    render(<OpenOrdersTable />);

    const cancelAllBtn = screen.getByRole("button", { name: /cancel all orders/i });
    expect(cancelAllBtn).toBeInTheDocument();
    expect(cancelAllBtn).toBeDisabled();
    expect(screen.getByText(/working orders:/i)).toBeInTheDocument();
  });

  it("renders active Cancel All Orders button with count and cancels all orders on click", () => {
    // Add 2 paper orders to store
    usePaperTradingStore.setState({
      openOrders: [
        {
          id: "ord-1",
          market: "BTC-USD-PERP",
          side: "buy",
          type: "limit",
          price: 70000,
          size: 0.5,
          status: "open",
          filledSize: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          source: "optimistic",
        },
        {
          id: "ord-2",
          market: "ETH-USD-PERP",
          side: "sell",
          type: "limit",
          price: 3500,
          size: 2.0,
          status: "open",
          filledSize: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          source: "optimistic",
        },
      ],
    });

    render(<OpenOrdersTable />);

    const cancelAllBtn = screen.getByRole("button", { name: /cancel all orders \(2\)/i });
    expect(cancelAllBtn).toBeInTheDocument();
    expect(cancelAllBtn).not.toBeDisabled();

    // Click Cancel All Orders
    fireEvent.click(cancelAllBtn);

    // Verify paperTradingStore openOrders is now empty
    expect(usePaperTradingStore.getState().openOrders.length).toBe(0);
  });
});
