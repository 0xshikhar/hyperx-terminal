import { create } from "zustand";
import { persist } from "zustand/middleware";

export type MarginMode = "cross" | "isolated";

export interface MarginSettingsState {
  marginMode: MarginMode;
  leverage: number;
  marketLeverage: Record<string, number>;
  setMarginMode: (mode: MarginMode) => void;
  setLeverage: (leverage: number, market?: string) => void;
  getLeverage: (market?: string) => number;
}

export const useMarginSettingsStore = create<MarginSettingsState>()(
  persist(
    (set, get) => ({
      marginMode: "cross",
      leverage: 10,
      marketLeverage: {},

      setMarginMode: (mode: MarginMode) => {
        set({ marginMode: mode });
      },

      setLeverage: (leverage: number, market?: string) => {
        const clamped = Math.max(1, Math.min(50, Math.round(leverage)));
        if (market) {
          set((state) => ({
            leverage: clamped,
            marketLeverage: {
              ...state.marketLeverage,
              [market]: clamped,
            },
          }));
        } else {
          set({ leverage: clamped });
        }
      },

      getLeverage: (market?: string) => {
        const state = get();
        if (market && state.marketLeverage[market]) {
          return state.marketLeverage[market];
        }
        return state.leverage || 10;
      },
    }),
    {
      name: "hyperx-margin-settings",
    }
  )
);
