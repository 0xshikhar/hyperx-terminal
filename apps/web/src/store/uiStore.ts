import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PanelLayout = {
  main: number[];
  left: number[];
  right: number[];
};

type UIState = {
  theme: "dark" | "light";
  defaultMarket: string;
  favoriteMarkets: string[];
  panelLayout: PanelLayout;
  setTheme: (theme: "dark" | "light") => void;
  setDefaultMarket: (market: string) => void;
  setFavoriteMarkets: (markets: string[]) => void;
  setPanelLayout: (layout: Partial<PanelLayout>) => void;
};

const defaultPanelLayout: PanelLayout = {
  main: [75, 25],
  left: [10, 50, 40],
  right: [60, 20, 20],
};

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: "dark",
      defaultMarket: "BTC-USD",
      favoriteMarkets: ["BTC-USD", "ETH-USD"],
      panelLayout: defaultPanelLayout,
      setTheme: (theme) => set({ theme }),
      setDefaultMarket: (market) => set({ defaultMarket: market }),
      setFavoriteMarkets: (markets) => set({ favoriteMarkets: markets }),
      setPanelLayout: (layout) =>
        set((state) => ({ panelLayout: { ...state.panelLayout, ...layout } })),
    }),
    {
      name: "hyperx-ui-store",
      partialize: (state) => ({
        theme: state.theme,
        defaultMarket: state.defaultMarket,
        favoriteMarkets: state.favoriteMarkets,
        panelLayout: state.panelLayout,
      }),
    }
  )
);
