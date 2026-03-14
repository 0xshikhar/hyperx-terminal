import { useEffect, useRef, useState } from "react";

type MemorySample = {
  timestamp: number;
  usedMB: number;
  limitMB: number | null;
};

type PerformanceMemory = {
  usedJSHeapSize: number;
  jsHeapSizeLimit: number;
};

type ExtendedPerformance = Performance & {
  memory?: PerformanceMemory;
};

let activeTrackerCount = 0;

export function useMemoryTracker(sampleSize = 30) {
  const [samples, setSamples] = useState<MemorySample[]>([]);
  const mountedRef = useRef(false);
  const [mountedComponents, setMountedComponents] = useState(activeTrackerCount);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      activeTrackerCount += 1;
      setMountedComponents(activeTrackerCount);
    }

    const collect = () => {
      const perf = performance as ExtendedPerformance;
      const usedJSHeapSize = perf.memory?.usedJSHeapSize ?? 0;
      const jsHeapSizeLimit = perf.memory?.jsHeapSizeLimit ?? 0;
      const sample: MemorySample = {
        timestamp: Date.now(),
        usedMB: usedJSHeapSize / (1024 * 1024),
        limitMB: jsHeapSizeLimit ? jsHeapSizeLimit / (1024 * 1024) : null,
      };

      setSamples((prev) => [...prev.slice(-(sampleSize - 1)), sample]);
    };

    collect();
    const interval = window.setInterval(collect, 2000);

    return () => {
      if (mountedRef.current) {
        mountedRef.current = false;
        activeTrackerCount = Math.max(0, activeTrackerCount - 1);
        setMountedComponents(activeTrackerCount);
      }
      window.clearInterval(interval);
    };
  }, [sampleSize]);

  const latest = samples[samples.length - 1] ?? null;
  const growthMB =
    samples.length > 1 ? latest!.usedMB - samples[0]!.usedMB : 0;

  return {
    samples,
    latest,
    mountedComponents,
    growthMB,
    isSupported: Boolean((performance as ExtendedPerformance).memory),
    sampleIntervalMs: 2000,
  };
}
