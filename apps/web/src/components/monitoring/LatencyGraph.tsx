import { useEffect, useMemo, useState } from "react";
import { Activity } from "lucide-react";
import { useLatencyStore } from "@/store/latencyStore";

type LatencyPoint = {
  timestamp: number;
  value: number;
};

export function LatencyGraph() {
  const { wsPing, apiLatency } = useLatencyStore((s) => s.latency);
  const [history, setHistory] = useState<LatencyPoint[]>([]);

  useEffect(() => {
    const next = wsPing ?? apiLatency;
    if (typeof next !== "number") return;
    setHistory((prev) => [...prev.slice(-29), { timestamp: Date.now(), value: next }]);
  }, [apiLatency, wsPing]);

  const stats = useMemo(() => {
    if (history.length === 0) return { min: 0, max: 0, avg: 0 };
    const values = history.map((item) => item.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    return { min, max, avg };
  }, [history]);

  const points = useMemo(() => {
    if (history.length < 2) return "";
    const max = Math.max(stats.max, 1);
    return history
      .map((point, index) => {
        const x = (index / Math.max(history.length - 1, 1)) * 100;
        const y = 100 - (point.value / max) * 100;
        return `${x},${y}`;
      })
      .join(" ");
  }, [history, stats.max]);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Activity className="h-4 w-4" />
          Latency Graph
        </h3>
        <span className="text-xs text-muted-foreground">
          {wsPing ? `${Math.round(wsPing)}ms ws` : "--"}
        </span>
      </div>

      <div className="rounded-md border border-border bg-background p-2">
        <svg viewBox="0 0 100 100" className="h-28 w-full">
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-primary"
            points={points}
          />
        </svg>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <Metric label="Min" value={`${stats.min.toFixed(0)}ms`} />
        <Metric label="Avg" value={`${stats.avg.toFixed(0)}ms`} />
        <Metric label="Max" value={`${stats.max.toFixed(0)}ms`} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted px-2 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="font-mono text-sm">{value}</div>
    </div>
  );
}
