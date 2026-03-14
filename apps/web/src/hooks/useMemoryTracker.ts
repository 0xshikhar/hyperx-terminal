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

export function useMemoryTracker(sampleSize = 30) {
  const [samples, setSamples] = useState<MemorySample[]>([]);
  const mountedRef = useRef(0);

  useEffect(() => {
    mountedRef.current += 1;

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
      mountedRef.current = Math.max(0, mountedRef.current - 1);
      window.clearInterval(interval);
    };
  }, [sampleSize]);

  const latest = samples[samples.length - 1] ?? null;
  const growthMB =
    samples.length > 1 ? latest!.usedMB - samples[0]!.usedMB : 0;

  return {
    samples,
    latest,
    mountedComponents: mountedRef.current,
    growthMB,
  };
}
