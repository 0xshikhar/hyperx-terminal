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

  it("records filled and cancelled orders into orderHistory", () => {
    const store = usePaperTradingStore.getState();
    // 1. Market order
    store.executeOrder(
      { market: "BTC-USD", side: "buy", type: "market", size: 0.1, leverage: 10 },
      60000
    );
    expect(usePaperTradingStore.getState().orderHistory).toHaveLength(1);
    expect(usePaperTradingStore.getState().orderHistory[0]).toMatchObject({
      market: "BTC-USD",
      status: "filled",
      side: "buy",
      type: "market",
    });

    // 2. Limit order placed then cancelled
    const limit = store.executeOrder({
      market: "ETH-USD",
      side: "buy",
      type: "limit",
      price: 2000,
      size: 1,
      leverage: 10,
    });
    expect(usePaperTradingStore.getState().openOrders).toHaveLength(1);
    store.cancelOrder(limit.orderId);
    expect(usePaperTradingStore.getState().openOrders).toHaveLength(0);
    expect(usePaperTradingStore.getState().orderHistory).toHaveLength(2);
    expect(usePaperTradingStore.getState().orderHistory[0]).toMatchObject({
      market: "ETH-USD",
      status: "cancelled",
    });
  });

  it("triggers stop-loss sell order only when price drops to or below stop price", () => {
    const store = usePaperTradingStore.getState();
    // Place stop loss at 50,000 for a long position
    store.executeOrder({
      market: "BTC-USD",
      side: "sell",
      type: "stop",
      stopPrice: 50000,
      size: 0.5,
      leverage: 10,
    });
    expect(usePaperTradingStore.getState().openOrders).toHaveLength(1);

    // Price stays above stop (55,000) -> should NOT trigger
    usePaperTradingStore.getState().onPriceTick("BTC-USD", 55000);
    expect(usePaperTradingStore.getState().openOrders).toHaveLength(1);

    // Price drops to 49,900 -> SHOULD trigger
    usePaperTradingStore.getState().onPriceTick("BTC-USD", 49900);
    expect(usePaperTradingStore.getState().openOrders).toHaveLength(0);
    expect(usePaperTradingStore.getState().orderHistory[0].status).toBe("filled");
  });

  it("settles simulated funding payment and appends to fundingHistory", () => {
    const store = usePaperTradingStore.getState();
    store.executeOrder(
      { market: "BTC-USD", side: "buy", type: "market", size: 1, leverage: 10 },
      60000
    );
    // Open position: Long 1 BTC @ 60,000. Notional: 60,000.
    // Funding rate: 0.0001 (0.01%). Long pays short: -60,000 * 0.0001 = -$6.00
    store.settleFundingPeriod("BTC-USD", 0.0001);
    const updated = usePaperTradingStore.getState();
    expect(updated.fundingHistory).toHaveLength(1);
    expect(updated.fundingHistory[0]).toMatchObject({
      market: "BTC-USD",
      payment: -6,
    });
  });

  it("creates and runs TWAP order slices", () => {
    const store = usePaperTradingStore.getState();
    const twapId = store.createTwapOrder({
      market: "BTC-USD",
      side: "buy",
      totalSize: 1.0,
      totalSlices: 4,
      intervalSeconds: 10,
    });
    const stateAfterCreate = usePaperTradingStore.getState();
    expect(stateAfterCreate.twapOrders).toHaveLength(1);
    expect(stateAfterCreate.twapOrders[0].status).toBe("running");
    expect(stateAfterCreate.twapOrders[0].sliceSize).toBe(0.25);

    // Execute first slice
    usePaperTradingStore.getState().executeTwapSlice(twapId, 60000);
    const updated = usePaperTradingStore.getState();
    expect(updated.twapOrders[0].executedSlices).toBe(1);
    expect(updated.twapOrders[0].executedSize).toBe(0.25);
    expect(updated.twapOrders[0].remainingSize).toBe(0.75);
    expect(updated.positions).toHaveLength(1);
  });
});
