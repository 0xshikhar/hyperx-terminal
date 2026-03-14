import { useMemo } from "react";
import { Activity } from "lucide-react";
import { useLatencyStore } from "@/store/latencyStore";

export function LatencyGraph() {
  const { wsPing, apiLatency, wsHistory, apiHistory } = useLatencyStore((s) => s.latency);

  const scaleMax = useMemo(() => {
    const maxValue = Math.max(
      1,
      ...wsHistory.map((point) => point.value),
      ...apiHistory.map((point) => point.value)
    );
    return Math.max(100, Math.ceil(maxValue / 25) * 25);
  }, [apiHistory, wsHistory]);

  const wsPoints = useMemo(() => buildPolyline(wsHistory, scaleMax), [scaleMax, wsHistory]);
  const apiPoints = useMemo(() => buildPolyline(apiHistory, scaleMax), [apiHistory, scaleMax]);

  const wsStats = useMemo(() => summarize(wsHistory), [wsHistory]);
  const apiStats = useMemo(() => summarize(apiHistory), [apiHistory]);
  const hasHistory = wsHistory.length > 1 || apiHistory.length > 1;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Activity className="h-4 w-4" />
          Latency History
        </h3>
        <span className="text-xs text-muted-foreground">Last 60 samples</span>
      </div>

      <div className="rounded-md border border-border bg-background p-2">
        <svg viewBox="0 0 100 100" className="h-28 w-full">
          {Array.from({ length: 4 }, (_, index) => {
            const y = 25 * (index + 1);
            return (
              <line
                key={y}
                x1="0"
                y1={y}
                x2="100"
                y2={y}
                stroke="currentColor"
                strokeOpacity="0.08"
                className="text-muted-foreground"
              />
            );
          })}
          {hasHistory ? (
            <>
              <polyline
                fill="none"
                strokeWidth="2"
                className="text-cyan-400"
                stroke="currentColor"
                points={wsPoints}
              />
              <polyline
                fill="none"
                strokeWidth="2"
                className="text-amber-400"
                stroke="currentColor"
                points={apiPoints}
              />
            </>
          ) : (
            <text
              x="50"
              y="52"
              textAnchor="middle"
              className="fill-muted-foreground text-[8px]"
            >
              Waiting for latency samples
            </text>
          )}
        </svg>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <Metric
          label="WS RTT"
          value={wsPing ? `${Math.round(wsPing)}ms` : "--"}
          helper={`p50 ${formatStat(wsStats.p50)} / p95 ${formatStat(wsStats.p95)}`}
          tone="cyan"
        />
        <Metric
          label="API RTT"
          value={apiLatency ? `${Math.round(apiLatency)}ms` : "--"}
          helper={`p50 ${formatStat(apiStats.p50)} / p95 ${formatStat(apiStats.p95)}`}
          tone="amber"
        />
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        Live samples show transport round-trip time only. Render latency is tracked separately via FPS and frame-time telemetry.
      </p>
    </div>
  );
}

function buildPolyline(history: { value: number }[], scaleMax: number) {
  if (history.length < 2) return "";
  return history
    .map((point, index) => {
      const x = (index / Math.max(history.length - 1, 1)) * 100;
      const y = 100 - (point.value / scaleMax) * 100;
      return `${x},${y}`;
    })
    .join(" ");
}

function percentile(values: number[], target: number) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(target * sorted.length) - 1));
  return sorted[index] ?? null;
}

function summarize(history: { value: number }[]) {
  const values = history.map((item) => item.value);
  return {
    p50: percentile(values, 0.5),
    p95: percentile(values, 0.95),
  };
}

function formatStat(value: number | null) {
  return value === null ? "--" : `${Math.round(value)}ms`;
}

function Metric({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  tone: "cyan" | "amber";
}) {
  const toneClass =
    tone === "cyan"
      ? "border-cyan-500/20 bg-cyan-500/5 text-cyan-400"
      : "border-amber-500/20 bg-amber-500/5 text-amber-400";

  return (
    <div className={`rounded-md border px-2 py-2 ${toneClass}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-80">
        {label}
      </div>
      <div className="font-mono text-sm font-semibold">{value}</div>
      <div className="text-[10px] opacity-80">{helper}</div>
    </div>
  );
}

export function LatencyLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-cyan-400" />
        WS RTT
      </span>
      <span className="flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        API RTT
      </span>
      <span>Scale auto-expands to current max sample</span>
    </div>
  );
}
