/**
 * useFPSMonitor Hook
 *
 * Real-time render performance monitoring using requestAnimationFrame.
 */

import { useEffect, useRef, useState } from "react";
import { useRenderMetricsStore } from "@/store/renderMetricsStore";

export interface FPSData {
  fps: number;
  frameTime: number;
  droppedFrames: number;
  isStable: boolean;
}

export function useFPSMonitor(): FPSData {
  const [fpsData, setFpsData] = useState<FPSData>({
    fps: 60,
    frameTime: 16.67,
    droppedFrames: 0,
    isStable: true,
  });

  // Refs to avoid re-renders during RAF loop
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(0);
  const droppedFramesRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);
  const setMetrics = useRenderMetricsStore((state) => state.setMetrics);

  useEffect(() => {
    lastTimeRef.current = performance.now();
    const updateFPS = () => {
      const now = performance.now();
      const delta = now - lastTimeRef.current;
      frameCountRef.current++;

      // Update every ~1 second (1000ms)
      if (delta >= 1000) {
        const fps = Math.round((frameCountRef.current * 1000) / delta);
        const frameTime = delta / frameCountRef.current;

        // Count dropped frames (any frame > 16.67ms = 60fps budget)
        const expectedFrames = delta / 16.67;
        const actualFrames = frameCountRef.current;
        if (actualFrames < expectedFrames * 0.9) {
          droppedFramesRef.current += Math.round(expectedFrames - actualFrames);
        }

        setFpsData({
          fps: Math.min(fps, 60), // Cap at 60 (monitor refresh rate)
          frameTime,
          droppedFrames: droppedFramesRef.current,
          isStable: fps >= 55 && frameTime <= 20,
        });
        setMetrics({
          fps: Math.min(fps, 60),
          frameTime,
          droppedFrames: droppedFramesRef.current,
        });

        // Reset counters
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }

      rafIdRef.current = requestAnimationFrame(updateFPS);
    };

    rafIdRef.current = requestAnimationFrame(updateFPS);

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [setMetrics]);

  return fpsData;
}
