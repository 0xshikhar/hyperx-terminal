import { useMemo } from "react";
import { Cpu } from "lucide-react";
import { useRenderMetricsStore } from "@/store/renderMetricsStore";

export function RenderHistory() {
  const fps = useRenderMetricsStore((state) => state.fps);
  const frameTime = useRenderMetricsStore((state) => state.frameTime);
  const fpsHistory = useRenderMetricsStore((state) => state.fpsHistory);
  const frameTimeHistory = useRenderMetricsStore((state) => state.frameTimeHistory);

  const fpsPoints = useMemo(() => buildPolyline(fpsHistory, 60), [fpsHistory]);
  const framePoints = useMemo(() => buildPolyline(frameTimeHistory, 50), [frameTimeHistory]);
  const fpsStats = useMemo(() => summarize(fpsHistory), [fpsHistory]);
  const frameStats = useMemo(() => summarize(frameTimeHistory), [frameTimeHistory]);
  const hasHistory = fpsHistory.length > 1 || frameTimeHistory.length > 1;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Cpu className="h-4 w-4" />
          Render History
        </h3>
        <span className="text-xs text-muted-foreground">Last 60 render samples</span>
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
                className="text-emerald-400"
                stroke="currentColor"
                points={fpsPoints}
              />
              <polyline
                fill="none"
                strokeWidth="2"
                className="text-fuchsia-400"
                stroke="currentColor"
                points={framePoints}
              />
            </>
          ) : (
            <text
              x="50"
              y="52"
              textAnchor="middle"
              className="fill-muted-foreground text-[8px]"
            >
              Waiting for render samples
            </text>
          )}
        </svg>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <Metric
          label="FPS"
          value={`${fps}`}
          helper={`p50 ${formatStat(fpsStats.p50)} / p95 ${formatStat(fpsStats.p95)}`}
          tone="emerald"
        />
        <Metric
          label="Frame Time"
          value={`${frameTime.toFixed(1)}ms`}
          helper={`p50 ${formatStat(frameStats.p50, "ms")} / p95 ${formatStat(frameStats.p95, "ms")}`}
          tone="fuchsia"
        />
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        FPS reflects visible paint cadence. Frame time is the render-side budget, separate from socket and API transport latency.
      </p>
    </div>
  );
}

function buildPolyline(history: { value: number }[], scaleMax: number) {
  if (history.length < 2) return "";
  return history
    .map((point, index) => {
      const x = (index / Math.max(history.length - 1, 1)) * 100;
      const clamped = Math.min(point.value, scaleMax);
      const y = 100 - (clamped / scaleMax) * 100;
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

function formatStat(value: number | null, suffix = "") {
  return value === null ? "--" : `${Math.round(value)}${suffix}`;
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
  tone: "emerald" | "fuchsia";
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
      : "border-fuchsia-500/20 bg-fuchsia-500/5 text-fuchsia-400";

  return (
    <div className={`rounded-md border px-2 py-2 ${toneClass}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-80">{label}</div>
      <div className="font-mono text-sm font-semibold">{value}</div>
      <div className="text-[10px] opacity-80">{helper}</div>
    </div>
  );
}
