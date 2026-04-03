import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PnLDisplayMode = "usd" | "percent" | "both";

interface PnLSettingsState {
  pnlMode: PnLDisplayMode;
  feeRate: number; // e.g. 0.0005 for 0.05% taker fee
  setPnlMode: (mode: PnLDisplayMode) => void;
  setFeeRate: (rate: number) => void;
}

export const usePnlSettingsStore = create<PnLSettingsState>()(
  persist(
    (set) => ({
      pnlMode: "both",
      feeRate: 0.0005, // 0.05% standard taker fee
      setPnlMode: (mode) => set({ pnlMode: mode }),
      setFeeRate: (rate) => set({ feeRate: rate }),
    }),
    {
      name: "hyperx-pnl-settings",
    }
  )
);

/**
 * Calculates exact round-trip fee-adjusted breakeven price.
 * Long exit needs to cover opening and closing fees: Entry * (1 + fee) / (1 - fee)
 * Short exit needs to cover opening and closing fees: Entry / ((1 + fee) / (1 - fee))
 */
export function calculateBreakevenPrice(
  side: "long" | "short",
  entryPrice: number,
  feeRate: number = 0.0005
): number {
  if (entryPrice <= 0) return 0;
  const multiplier = (1 + feeRate) / (1 - feeRate);
  return side === "long" ? entryPrice * multiplier : entryPrice / multiplier;
}
