import { create } from "zustand";

type MetricSample = {
  timestamp: number;
  value: number;
};

type RenderMetricsState = {
  fps: number;
  frameTime: number;
  droppedFrames: number;
  fpsHistory: MetricSample[];
  frameTimeHistory: MetricSample[];
  setMetrics: (metrics: {
    fps: number;
    frameTime: number;
    droppedFrames: number;
  }) => void;
};

const MAX_SAMPLES = 60;

function appendSample(history: MetricSample[], value: number) {
  return [...history.slice(-(MAX_SAMPLES - 1)), { timestamp: Date.now(), value }];
}

export const useRenderMetricsStore = create<RenderMetricsState>()((set) => ({
  fps: 60,
  frameTime: 16.67,
  droppedFrames: 0,
  fpsHistory: [],
  frameTimeHistory: [],
  setMetrics: (metrics) =>
    set((state) => ({
      ...metrics,
      fpsHistory: appendSample(state.fpsHistory, metrics.fps),
      frameTimeHistory: appendSample(state.frameTimeHistory, metrics.frameTime),
    })),
}));
