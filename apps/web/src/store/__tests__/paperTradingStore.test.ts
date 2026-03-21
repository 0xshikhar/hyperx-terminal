import { beforeEach, describe, expect, it } from "vitest";
import { usePaperTradingStore } from "../paperTradingStore";

describe("paperTradingStore", () => {
  beforeEach(() => {
    usePaperTradingStore.getState().resetAccount();
  });

  it("initializes with $10,000 virtual balance and empty state", () => {
    const state = usePaperTradingStore.getState();
    expect(state.balance).toBe(10000);
    expect(state.positions).toEqual([]);
    expect(state.openOrders).toEqual([]);
    expect(state.tradeHistory).toEqual([]);
  });

  it("executes a market buy order, deducts margin, and opens a position", () => {
    const store = usePaperTradingStore.getState();
    const res = store.executeOrder(
      {
        market: "BTC-USD",
        side: "buy",
        type: "market",
        size: 0.5,
        leverage: 10,
      },
      60000
    );

    expect(res.status).toBe("filled");
    expect(res.price).toBe(60000);

    const updated = usePaperTradingStore.getState();
    // 0.5 * 60,000 = $30,000 notional. 10x leverage = $3,000 margin.
    expect(updated.balance).toBe(7000);
    expect(updated.positions).toHaveLength(1);
    expect(updated.positions[0]).toMatchObject({
      market: "BTC-USD",
      side: "long",
      size: 0.5,
      entryPrice: 60000,
      margin: 3000,
      leverage: 10,
      pnl: 0,
    });
    expect(updated.tradeHistory).toHaveLength(1);
  });

  it("updates position markPrice and unrealized PnL on price ticks", () => {
    const store = usePaperTradingStore.getState();
    store.executeOrder(
      {
        market: "BTC-USD",
        side: "buy",
        type: "market",
        size: 1,
        leverage: 10,
      },
      50000
    );

    // Price moves to $55,000 (+10% on 10x leverage = +100% ROE)
    usePaperTradingStore.getState().onPriceTick("BTC-USD", 55000);

    const pos = usePaperTradingStore.getState().positions[0];
    expect(pos.markPrice).toBe(55000);
    expect(pos.pnl).toBe(5000);
    expect(pos.pnlPercent).toBe(100);
  });

  it("places limit order, reserves margin, and fills on tick cross", () => {
    const store = usePaperTradingStore.getState();
    const res = store.executeOrder(
      {
        market: "ETH-USD",
        side: "buy",
        type: "limit",
        size: 2,
        price: 3000,
        leverage: 10,
      }
    );

    expect(res.status).toBe("open");
    // 2 * 3,000 / 10 = $600 margin reserved
    expect(usePaperTradingStore.getState().balance).toBe(9400);
    expect(usePaperTradingStore.getState().openOrders).toHaveLength(1);

    // Tick above limit: no fill
    usePaperTradingStore.getState().onPriceTick("ETH-USD", 3100);
    expect(usePaperTradingStore.getState().openOrders).toHaveLength(1);
    expect(usePaperTradingStore.getState().positions).toHaveLength(0);

    // Tick at/below limit: triggers fill
    usePaperTradingStore.getState().onPriceTick("ETH-USD", 2950);
    expect(usePaperTradingStore.getState().openOrders).toHaveLength(0);
    expect(usePaperTradingStore.getState().positions).toHaveLength(1);
    expect(usePaperTradingStore.getState().positions[0].market).toBe("ETH-USD");
  });

  it("closes an open position and credits realized PnL back to balance", () => {
    const store = usePaperTradingStore.getState();
    store.executeOrder(
      {
        market: "BTC-USD",
        side: "buy",
        type: "market",
        size: 1,
        leverage: 10,
      },
      50000
    );
    // Balance is 10000 - 5000 = 5000

    const posId = usePaperTradingStore.getState().positions[0].id;
    // Close at 52,000 (+2,000 profit)
    const { realizedPnl } = usePaperTradingStore.getState().closePosition(posId, 52000);

    expect(realizedPnl).toBe(2000);
    const finalState = usePaperTradingStore.getState();
    expect(finalState.positions).toHaveLength(0);
    // 5000 + 5000 (margin returned) + 2000 (profit) = 12000
    expect(finalState.balance).toBe(12000);
    expect(finalState.tradeHistory[0].realizedPnl).toBe(2000);
  });

  it("adds test funds via faucet", () => {
    usePaperTradingStore.getState().faucet(5000);
    expect(usePaperTradingStore.getState().balance).toBe(15000);
  });
});
