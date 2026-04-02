import { describe, expect, it, beforeEach } from "vitest";
import { usePaperTradingStore } from "../paperTradingStore";

describe("paperTradingStore: partialClosePosition", () => {
  beforeEach(() => {
    usePaperTradingStore.getState().resetAccount();
  });

  it("partially closes 50% of an open position and credits released margin + PnL", () => {
    const store = usePaperTradingStore.getState();

    // 1. Open a Long position of 1.0 BTC @ $70,000 with 10x leverage
    // Required Margin: ($70,000 * 1.0) / 10 = $7,000
    // Starting balance: $10,000 -> Balance after order: $3,000
    store.executeOrder(
      {
        market: "BTC-USD-PERP",
        side: "buy",
        type: "market",
        size: 1.0,
        leverage: 10,
      },
      70000
    );

    const pos = usePaperTradingStore.getState().positions.find((p) => p.market === "BTC-USD-PERP");
    expect(pos).toBeDefined();
    expect(pos?.size).toBe(1.0);
    expect(pos?.margin).toBe(7000);
    expect(usePaperTradingStore.getState().balance).toBe(3000);

    // 2. Mark price rises to $72,000 (+ $2,000 profit for 1.0 BTC)
    // Partial close 0.5 BTC at $72,000
    // Closed ratio = 0.5 / 1.0 = 50%
    // Margin released = $7,000 * 0.5 = $3,500
    // Realized PnL = ($72,000 - $70,000) * 0.5 = $1,000
    // Returned funds = $3,500 + $1,000 = $4,500
    // New Balance = $3,000 + $4,500 = $7,500
    const { realizedPnl, remainingSize } = usePaperTradingStore
      .getState()
      .partialClosePosition(pos!.id, 0.5, 72000);

    expect(realizedPnl).toBe(1000);
    expect(remainingSize).toBe(0.5);

    const updatedPos = usePaperTradingStore.getState().positions.find((p) => p.id === pos!.id);
    expect(updatedPos).toBeDefined();
    expect(updatedPos?.size).toBe(0.5);
    expect(updatedPos?.margin).toBe(3500);
    expect(usePaperTradingStore.getState().balance).toBe(7500);

    // Trade history record should be created
    const trade = usePaperTradingStore.getState().tradeHistory[0];
    expect(trade.size).toBe(0.5);
    expect(trade.realizedPnl).toBe(1000);
    expect(trade.price).toBe(72000);
  });

  it("completely removes position when closing full size or greater", () => {
    const store = usePaperTradingStore.getState();

    store.executeOrder(
      {
        market: "ETH-USD-PERP",
        side: "buy",
        type: "market",
        size: 2.0,
        leverage: 10,
      },
      3000
    );

    const pos = usePaperTradingStore.getState().positions[0];
    expect(pos).toBeDefined();

    const { realizedPnl, remainingSize } = usePaperTradingStore
      .getState()
      .partialClosePosition(pos.id, 2.0, 3100);

    expect(remainingSize).toBe(0);
    expect(realizedPnl).toBe(200);
    expect(usePaperTradingStore.getState().positions).toHaveLength(0);
  });

  it("places limit reduce-only order when orderType is limit", () => {
    const store = usePaperTradingStore.getState();

    store.executeOrder(
      {
        market: "BTC-USD-PERP",
        side: "buy",
        type: "market",
        size: 1.0,
        leverage: 10,
      },
      70000
    );

    const pos = usePaperTradingStore.getState().positions[0];

    const result = usePaperTradingStore
      .getState()
      .partialClosePosition(pos.id, 0.5, 75000, "limit");

    expect(result.remainingSize).toBe(1.0); // position remains open until limit order fills
    expect(usePaperTradingStore.getState().openOrders).toHaveLength(1);

    const limitOrder = usePaperTradingStore.getState().openOrders[0];
    expect(limitOrder.side).toBe("sell"); // Opposite side to reduce long
    expect(limitOrder.price).toBe(75000);
    expect(limitOrder.size).toBe(0.5);
  });
});
