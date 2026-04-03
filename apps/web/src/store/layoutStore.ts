import { create } from "zustand";

export type LayoutPreset = "default" | "scalper" | "depth";

interface LayoutState {
  isFullscreenChart: boolean;
  layoutPreset: LayoutPreset;
  layoutVersion: number;
  setFullscreenChart: (val: boolean) => void;
  toggleFullscreenChart: () => void;
  setLayoutPreset: (preset: LayoutPreset) => void;
  resetLayout: () => void;
}

const STORAGE_KEYS = [
  "hyperx-terminal-panels-main",
  "hyperx-terminal-panels-left",
  "hyperx-terminal-panels-top",
];

export const useLayoutStore = create<LayoutState>((set) => ({
  isFullscreenChart: false,
  layoutPreset: "default",
  layoutVersion: 0,

  setFullscreenChart: (val) => set({ isFullscreenChart: val }),
  toggleFullscreenChart: () =>
    set((state) => ({ isFullscreenChart: !state.isFullscreenChart })),

  setLayoutPreset: (preset) => {
    try {
      if (preset === "scalper") {
        localStorage.setItem(
          "hyperx-terminal-panels-main",
          JSON.stringify([82, 18])
        );
        localStorage.setItem(
          "hyperx-terminal-panels-left",
          JSON.stringify([80, 20])
        );
        localStorage.setItem(
          "hyperx-terminal-panels-top",
          JSON.stringify([65, 35])
        );
      } else if (preset === "depth") {
        localStorage.setItem(
          "hyperx-terminal-panels-main",
          JSON.stringify([78, 22])
        );
        localStorage.setItem(
          "hyperx-terminal-panels-left",
          JSON.stringify([70, 30])
        );
        localStorage.setItem(
          "hyperx-terminal-panels-top",
          JSON.stringify([50, 50])
        );
      } else {
        STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
      }
    } catch {}

    set((s) => ({ layoutPreset: preset, layoutVersion: s.layoutVersion + 1 }));
  },

  resetLayout: () => {
    try {
      STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    } catch {}
    set((s) => ({
      layoutPreset: "default",
      isFullscreenChart: false,
      layoutVersion: s.layoutVersion + 1,
    }));
  },
}));
