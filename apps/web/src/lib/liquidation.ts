/**
 * Liquidation price estimation.
 *
 * Approximates venue math with a maintenance-margin floor:
 *   long:  liq = entry * (1 - 1/leverage + mmr)
 *   short: liq = entry * (1 + 1/leverage - mmr)
 *
 * `mmr` is the maintenance margin rate — 0.5% approximates Paradex/Hyperliquid
 * base tiers. For exactness, per-market mm tiers + wallet balance offset are
 * needed (noted in benchmark.md gaps).
 */
export const MAINTENANCE_MARGIN_RATE = 0.005;

export function estimateLiquidationPrice(
  side: "long" | "short" | "buy" | "sell",
  entryPrice: number,
  leverage: number,
  mmr: number = MAINTENANCE_MARGIN_RATE
): number | null {
  if (!entryPrice || entryPrice <= 0 || !leverage || leverage <= 0) return null;
  const isLong = side === "long" || side === "buy";
  const marginFraction = 1 / leverage;
  const price = isLong
    ? entryPrice * (1 - marginFraction + mmr)
    : entryPrice * (1 + marginFraction - mmr);
  return price > 0 ? price : 0;
}
