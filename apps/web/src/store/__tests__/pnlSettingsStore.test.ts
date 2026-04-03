import { describe, it, expect, beforeEach } from "vitest";
import {
  usePnlSettingsStore,
  calculateBreakevenPrice,
} from "@/store/pnlSettingsStore";

describe("pnlSettingsStore & Breakeven Engine", () => {
  beforeEach(() => {
    usePnlSettingsStore.setState({
      pnlMode: "both",
      feeRate: 0.0005,
    });
  });

  it("initializes with default both mode and 0.05% fee rate", () => {
    const state = usePnlSettingsStore.getState();
    expect(state.pnlMode).toBe("both");
    expect(state.feeRate).toBe(0.0005);
  });

  it("updates PnL display mode", () => {
    usePnlSettingsStore.getState().setPnlMode("usd");
    expect(usePnlSettingsStore.getState().pnlMode).toBe("usd");

    usePnlSettingsStore.getState().setPnlMode("percent");
    expect(usePnlSettingsStore.getState().pnlMode).toBe("percent");
  });

  it("calculates accurate fee-adjusted breakeven price for long positions", () => {
    const entryPrice = 50000;
    const feeRate = 0.0005; // 0.05%
    const bePrice = calculateBreakevenPrice("long", entryPrice, feeRate);

    // Long must exit higher than entry to cover open + close fees
    expect(bePrice).toBeGreaterThan(entryPrice);
    // (1 + 0.0005) / (1 - 0.0005) ≈ 1.0010005 => 50050.025
    expect(bePrice).toBeCloseTo(50050.025, 2);
  });

  it("calculates accurate fee-adjusted breakeven price for short positions", () => {
    const entryPrice = 50000;
    const feeRate = 0.0005; // 0.05%
    const bePrice = calculateBreakevenPrice("short", entryPrice, feeRate);

    // Short must exit lower than entry to cover open + close fees
    expect(bePrice).toBeLessThan(entryPrice);
    // 50000 / ((1 + 0.0005) / (1 - 0.0005)) = 50000 * 0.9995 / 1.0005 = 49950.025
    expect(bePrice).toBeCloseTo(49950.025, 2);
  });

  it("handles edge cases where entry price is 0 or negative", () => {
    expect(calculateBreakevenPrice("long", 0)).toBe(0);
    expect(calculateBreakevenPrice("short", -10)).toBe(0);
  });
});
