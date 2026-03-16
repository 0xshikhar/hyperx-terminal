import { create } from "zustand";

type RenderMetricsState = {
  fps: number;
  frameTime: number;
  droppedFrames: number;
  setMetrics: (metrics: {
    fps: number;
    frameTime: number;
    droppedFrames: number;
  }) => void;
};

export const useRenderMetricsStore = create<RenderMetricsState>()((set) => ({
  fps: 60,
  frameTime: 16.67,
  droppedFrames: 0,
  setMetrics: (metrics) => set(metrics),
}));
