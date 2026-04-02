import { describe, expect, it } from "vitest";
import { calculateScaledOrders } from "../useScaledOrders";

describe("calculateScaledOrders", () => {
  it("generates correct number of rungs with flat distribution", () => {
    const result = calculateScaledOrders({
      startPrice: 70000,
      endPrice: 66000,
      totalSize: 1.0,
      orderCount: 5,
      distribution: "flat",
      leverage: 10,
    });

    expect(result.isValid).toBe(true);
    expect(result.orders).toHaveLength(5);
    expect(result.orders[0].price).toBe(70000);
    expect(result.orders[4].price).toBe(66000);

    // Flat distribution: each of the 5 orders should have 0.20 size
    for (const rung of result.orders) {
      expect(rung.size).toBe(0.2);
    }

    // Sum of sizes must equal totalSize
    const sumSize = result.orders.reduce((acc, r) => acc + r.size, 0);
    expect(Number(sumSize.toFixed(4))).toBe(1.0);

    // Average price should be exactly the midpoint for linear flat
    expect(result.averagePrice).toBe(68000);
    expect(result.requiredMargin).toBe(result.totalNotional / 10);
  });

  it("allocates increasing sizes deeper into the band for pyramid distribution", () => {
    const result = calculateScaledOrders({
      startPrice: 70000,
      endPrice: 66000,
      totalSize: 2.0,
      orderCount: 4,
      distribution: "pyramid",
      leverage: 10,
    });

    expect(result.isValid).toBe(true);
    expect(result.orders).toHaveLength(4);

    // Deepest order (index 4) should have larger size than shallowest order (index 1)
    expect(result.orders[3].size).toBeGreaterThan(result.orders[0].size);

    const sumSize = result.orders.reduce((acc, r) => acc + r.size, 0);
    expect(Math.abs(sumSize - 2.0)).toBeLessThan(0.01);
  });

  it("allocates decreasing sizes for inverted distribution", () => {
    const result = calculateScaledOrders({
      startPrice: 70000,
      endPrice: 66000,
      totalSize: 1.0,
      orderCount: 4,
      distribution: "inverted",
      leverage: 10,
    });

    expect(result.isValid).toBe(true);
    // First order should be larger than last order
    expect(result.orders[0].size).toBeGreaterThan(result.orders[3].size);
  });

  it("clamps order count between 3 and 10", () => {
    const minResult = calculateScaledOrders({
      startPrice: 70000,
      endPrice: 68000,
      totalSize: 1.0,
      orderCount: 1, // below min
      distribution: "flat",
    });
    expect(minResult.orders).toHaveLength(3);

    const maxResult = calculateScaledOrders({
      startPrice: 70000,
      endPrice: 68000,
      totalSize: 1.0,
      orderCount: 25, // above max
      distribution: "flat",
    });
    expect(maxResult.orders).toHaveLength(10);
  });

  it("returns validation error for equal or invalid prices", () => {
    const equalResult = calculateScaledOrders({
      startPrice: 70000,
      endPrice: 70000,
      totalSize: 1.0,
      orderCount: 5,
      distribution: "flat",
    });
    expect(equalResult.isValid).toBe(false);
    expect(equalResult.validationError).toBe("Start and end prices cannot be equal");

    const zeroResult = calculateScaledOrders({
      startPrice: 0,
      endPrice: 70000,
      totalSize: 1.0,
      orderCount: 5,
      distribution: "flat",
    });
    expect(zeroResult.isValid).toBe(false);
  });
});
