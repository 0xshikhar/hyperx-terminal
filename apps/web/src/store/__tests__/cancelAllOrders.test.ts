import { describe, expect, it, beforeEach } from "vitest";
import { usePaperTradingStore } from "../paperTradingStore";
import { useOrdersStore } from "../ordersStore";

describe("cancelAllOrders Panic Action", () => {
  beforeEach(() => {
    usePaperTradingStore.getState().resetAccount();
    useOrdersStore.setState({ openOrders: [] });
  });

  describe("paperTradingStore.cancelAllOrders", () => {
    it("cancels all active orders across all markets, refunds reserved margin, and updates order history", () => {
      const store = usePaperTradingStore.getState();

      // Initial balance: $10,000
      // Place Order 1: Buy 0.5 BTC @ $70,000 (Reserved margin: 0.5 * 70,000 / 10 = $3,500)
      store.executeOrder(
        {
          market: "BTC-USD-PERP",
          side: "buy",
          type: "limit",
          price: 70000,
          size: 0.5,
          leverage: 10,
        },
        72000 // mark price > order price => limit order sits open in book
      );

      // Place Order 2: Sell 2.0 ETH @ $3,800 (Reserved margin: 2.0 * 3,800 / 10 = $760)
      store.executeOrder(
        {
          market: "ETH-USD-PERP",
          side: "sell",
          type: "limit",
          price: 3800,
          size: 2.0,
          leverage: 10,
        },
        3500 // mark price < order price => limit order sits open in book
      );

      expect(usePaperTradingStore.getState().openOrders.length).toBe(2);
      // Balance after reserving $3,500 + $760 = $4,260 => $10,000 - $4,260 = $5,740
      expect(usePaperTradingStore.getState().balance).toBe(5740);

      // Execute Panic Cancel All
      const { cancelledCount, refundedMargin } = usePaperTradingStore.getState().cancelAllOrders();

      expect(cancelledCount).toBe(2);
      expect(refundedMargin).toBe(4260);

      // Store state after cancel
      expect(usePaperTradingStore.getState().openOrders.length).toBe(0);
      expect(usePaperTradingStore.getState().balance).toBe(10000);

      // Order history should contain the cancelled records
      const history = usePaperTradingStore.getState().orderHistory;
      expect(history.length).toBe(2);
      expect(history.every((h) => h.status === "cancelled")).toBe(true);
    });

    it("cancels only orders for a specific market when market parameter is provided", () => {
      const store = usePaperTradingStore.getState();

      // Order 1: BTC
      store.executeOrder(
        {
          market: "BTC-USD-PERP",
          side: "buy",
          type: "limit",
          price: 65000,
          size: 1.0,
          leverage: 10,
        },
        70000
      );

      // Order 2: ETH
      store.executeOrder(
        {
          market: "ETH-USD-PERP",
          side: "buy",
          type: "limit",
          price: 3000,
          size: 1.0,
          leverage: 10,
        },
        3500
      );

      expect(usePaperTradingStore.getState().openOrders.length).toBe(2);

      // Cancel only BTC orders
      const { cancelledCount } = usePaperTradingStore.getState().cancelAllOrders("BTC-USD-PERP");
      expect(cancelledCount).toBe(1);

      const remaining = usePaperTradingStore.getState().openOrders;
      expect(remaining.length).toBe(1);
      expect(remaining[0].market).toBe("ETH-USD-PERP");
    });

    it("returns 0 and does not change balance if no orders exist", () => {
      const { cancelledCount, refundedMargin } = usePaperTradingStore.getState().cancelAllOrders();
      expect(cancelledCount).toBe(0);
      expect(refundedMargin).toBe(0);
      expect(usePaperTradingStore.getState().balance).toBe(10000);
    });
  });

  describe("ordersStore.cancelAllOrders", () => {
    it("marks all cancellable orders as cancelled", () => {
      useOrdersStore.setState({
        openOrders: [
          {
            id: "ord-1",
            market: "BTC-USD",
            side: "buy",
            type: "limit",
            price: 70000,
            size: 1,
            status: "open",
            filledSize: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            source: "optimistic",
          },
          {
            id: "ord-2",
            market: "ETH-USD",
            side: "sell",
            type: "limit",
            price: 3500,
            size: 2,
            status: "pending",
            filledSize: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            source: "optimistic",
          },
          {
            id: "ord-3",
            market: "BTC-USD",
            side: "buy",
            type: "limit",
            price: 68000,
            size: 0.5,
            status: "filled",
            filledSize: 0.5,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            source: "api",
          },
        ],
      });

      const cancelledCount = useOrdersStore.getState().cancelAllOrders();
      expect(cancelledCount).toBe(2);

      const orders = useOrdersStore.getState().openOrders;
      expect(orders.find((o) => o.id === "ord-1")?.status).toBe("cancelled");
      expect(orders.find((o) => o.id === "ord-2")?.status).toBe("cancelled");
      // Filled order is not cancellable
      expect(orders.find((o) => o.id === "ord-3")?.status).toBe("filled");
    });
  });
});
