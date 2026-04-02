import { describe, expect, it, beforeEach } from "vitest";
import { usePaperTradingStore } from "../paperTradingStore";

describe("paperTradingStore: Take-Profit and Stop-Loss (TP/SL) Bracket Execution", () => {
  beforeEach(() => {
    usePaperTradingStore.getState().resetAccount();
  });

  it("updates position takeProfit and stopLoss bracket settings", () => {
    const store = usePaperTradingStore.getState();

    // Open 1.0 BTC Long @ $70,000
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

    // Set TP to $75,000 and SL to $68,000
    usePaperTradingStore.getState().updatePositionTPSL(pos!.id, 75000, 68000);

    const updatedPos = usePaperTradingStore.getState().positions.find((p) => p.id === pos!.id);
    expect(updatedPos?.takeProfit).toBe(75000);
    expect(updatedPos?.stopLoss).toBe(68000);

    // Remove TP only
    usePaperTradingStore.getState().updatePositionTPSL(pos!.id, undefined, 68000);
    const posWithoutTP = usePaperTradingStore.getState().positions.find((p) => p.id === pos!.id);
    expect(posWithoutTP?.takeProfit).toBeUndefined();
    expect(posWithoutTP?.stopLoss).toBe(68000);
  });

  it("automatically executes Take-Profit for LONG position when price ticks >= TP", () => {
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

    const pos = usePaperTradingStore.getState().positions.find((p) => p.market === "BTC-USD-PERP");
    expect(pos).toBeDefined();

    // Set TP to $72,000
    usePaperTradingStore.getState().updatePositionTPSL(pos!.id, 72000, 67000);

    // Price moves to $71,000 (below TP)
    usePaperTradingStore.getState().onPriceTick("BTC-USD-PERP", 71000);
    expect(usePaperTradingStore.getState().positions.length).toBe(1);

    // Price ticks up to $72,500 (breaches TP)
    usePaperTradingStore.getState().onPriceTick("BTC-USD-PERP", 72500);

    // Position should be closed
    const closedPositions = usePaperTradingStore.getState().positions.filter((p) => p.market === "BTC-USD-PERP");
    expect(closedPositions.length).toBe(0);

    // Trade history should reflect opening order + closing profit of ($72,500 - $70,000) * 1.0 = +$2,500
    const trades = usePaperTradingStore.getState().tradeHistory;
    expect(trades.length).toBe(2);
    expect(trades[0].realizedPnl).toBe(2500);
  });

  it("automatically executes Stop-Loss for LONG position when price ticks <= SL", () => {
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

    const pos = usePaperTradingStore.getState().positions.find((p) => p.market === "BTC-USD-PERP");
    expect(pos).toBeDefined();

    // Set SL to $68,000
    usePaperTradingStore.getState().updatePositionTPSL(pos!.id, 75000, 68000);

    // Price drops to $67,900 (breaches SL)
    usePaperTradingStore.getState().onPriceTick("BTC-USD-PERP", 67900);

    // Position should be closed
    const positions = usePaperTradingStore.getState().positions.filter((p) => p.market === "BTC-USD-PERP");
    expect(positions.length).toBe(0);

    // Realized PnL: ($67,900 - $70,000) = -$2,100
    const trades = usePaperTradingStore.getState().tradeHistory;
    expect(trades.length).toBe(2);
    expect(trades[0].realizedPnl).toBe(-2100);
  });

  it("automatically executes TP and SL for SHORT positions", () => {
    const store = usePaperTradingStore.getState();

    // Open Short 2.0 ETH @ $3,500
    store.executeOrder(
      {
        market: "ETH-USD-PERP",
        side: "sell",
        type: "market",
        size: 2.0,
        leverage: 5,
      },
      3500
    );

    const pos = usePaperTradingStore.getState().positions.find((p) => p.market === "ETH-USD-PERP");
    expect(pos).toBeDefined();

    // For short: TP is lower ($3,200), SL is higher ($3,700)
    usePaperTradingStore.getState().updatePositionTPSL(pos!.id, 3200, 3700);

    // Price drops to $3,150 (triggers short TP)
    usePaperTradingStore.getState().onPriceTick("ETH-USD-PERP", 3150);

    expect(usePaperTradingStore.getState().positions.length).toBe(0);
    const trade = usePaperTradingStore.getState().tradeHistory[0];
    // Short profit: ($3,500 - $3,150) * 2.0 = $700
    expect(trade.realizedPnl).toBe(700);
  });
});
