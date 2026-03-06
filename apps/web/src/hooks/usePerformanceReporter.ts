import { useCallback, useRef } from "react";
import { reportMetrics, type MetricPayload } from "@/services/apiClient/metrics.api";

export function usePerformanceReporter() {
  const queueRef = useRef<MetricPayload[]>([]);
  const flushTimerRef = useRef<number | null>(null);

  const flush = useCallback(async () => {
    const batch = queueRef.current;
    if (batch.length === 0) return;
    queueRef.current = [];
    if (flushTimerRef.current) {
      window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    try {
      await reportMetrics(batch);
    } catch {
      queueRef.current = batch.concat(queueRef.current).slice(0, 200);
    }
  }, []);

  const report = useCallback(
    (metric: MetricPayload) => {
      queueRef.current.push(metric);
      if (queueRef.current.length >= 10) {
        flush();
        return;
      }
      if (!flushTimerRef.current) {
        flushTimerRef.current = window.setTimeout(() => {
          flush();
        }, 2000);
      }
    },
    [flush]
  );

  return { report, flush };
}
