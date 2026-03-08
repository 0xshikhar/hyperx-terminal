import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PanelLayout = {
  main: number[];
  left: number[];
  right: number[];
};

export type Theme = "dark" | "light" | "system";

type UIState = {
  theme: Theme;
  defaultMarket: string;
  favoriteMarkets: string[];
  panelLayout: PanelLayout;
  setTheme: (theme: Theme) => void;
  setDefaultMarket: (market: string) => void;
  setFavoriteMarkets: (markets: string[]) => void;
  setPanelLayout: (layout: Partial<PanelLayout>) => void;
  toggleTheme: () => void;
};

const defaultPanelLayout: PanelLayout = {
  main: [75, 25],
  left: [10, 50, 40],
  right: [60, 20, 20],
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function normalizePanelRow(
  values: number[] | undefined,
  fallback: number[],
  min: number
): number[] {
  if (!values || values.length !== fallback.length) return fallback;
  const numeric = values.map((value) =>
    Number.isFinite(value) ? clamp(value, min, 100) : min
  );
  const total = numeric.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return fallback;
  return numeric.map((value) => Number(((value / total) * 100).toFixed(2)));
}

function sanitizePanelLayout(layout?: Partial<PanelLayout>): PanelLayout {
  return {
    main: normalizePanelRow(layout?.main, defaultPanelLayout.main, 5),
    left: normalizePanelRow(layout?.left, defaultPanelLayout.left, 5),
    right: normalizePanelRow(layout?.right, defaultPanelLayout.right, 5),
  };
}

// Get system theme preference
const getSystemTheme = (): "dark" | "light" => {
  if (typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "dark";
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
        set((state) => ({
          panelLayout: sanitizePanelLayout({ ...state.panelLayout, ...layout }),
        })),
      toggleTheme: () =>
        set((state) => {
          const themes: Theme[] = ["light", "dark"];
          const currentIndex = themes.indexOf(state.theme as "light" | "dark");
          const nextIndex = (currentIndex + 1) % themes.length;
          return { theme: themes[nextIndex] };
        }),
    }),
    {
      name: "hyperx-ui-store",
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as Partial<UIState> | undefined) ?? {};
        const base = { ...currentState, ...persisted };
        return {
          ...base,
          panelLayout: sanitizePanelLayout(
            (persisted as Partial<UIState>).panelLayout
          ),
        };
      },
      partialize: (state) => ({
        theme: state.theme,
        defaultMarket: state.defaultMarket,
        favoriteMarkets: state.favoriteMarkets,
        panelLayout: state.panelLayout,
      }),
    }
  )
);

// Get effective theme (resolves "system" to actual theme)
export const getEffectiveTheme = (theme: Theme): "dark" | "light" => {
  if (theme === "system") {
    return getSystemTheme();
  }
  return theme;
};
