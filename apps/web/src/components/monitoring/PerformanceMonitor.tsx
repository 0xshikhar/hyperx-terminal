import { useEffect } from "react";
import { usePerformanceReporter } from "@/hooks/usePerformanceReporter";

export function PerformanceMonitor() {
  const { report } = usePerformanceReporter();

  useEffect(() => {
    if (typeof PerformanceObserver === "undefined") return undefined;

    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.entryType === "longtask") {
          report({
            name: "longtask",
            value: entry.duration,
            timestamp: Date.now(),
            meta: {
              startTime: entry.startTime,
            },
          });
        }
      });
    });

    try {
      observer.observe({ type: "longtask", buffered: true });
    } catch {
      return undefined;
    }

    return () => observer.disconnect();
  }, [report]);

  return null;
}
