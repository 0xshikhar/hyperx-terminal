import type { ReactNode } from "react";
import { Cpu, Gauge, MemoryStick } from "lucide-react";
import { PerformancePanel } from "@/components/monitoring/FPSCounter";
import { LatencyGraph, LatencyLegend } from "@/components/monitoring/LatencyGraph";
import { useMemoryTracker } from "@/hooks/useMemoryTracker";
import { useLatencyStore } from "@/store/latencyStore";

const ORDERBOOK_FLUSH_WINDOW_MS = 50;
const CHART_FRAME_BUDGET_MS = 16.7;

export function PerformanceDashboard() {
  const { latest, growthMB, mountedComponents, isSupported, sampleIntervalMs } = useMemoryTracker();
  const { wsPing, apiLatency } = useLatencyStore((s) => s.latency);

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Gauge className="h-4 w-4" />
          Performance Dashboard
        </h2>
        <span className="text-xs text-muted-foreground">Live telemetry and render budgets</span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr,1fr]">
        <PerformancePanel />
        <div className="space-y-3">
          <LatencyGraph />
          <LatencyLegend />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <StatCard
          icon={<MemoryStick className="h-4 w-4" />}
          label="Heap Used"
          value={latest ? `${latest.usedMB.toFixed(1)} MB` : "Unsupported"}
          helper={
            latest?.limitMB ? `Limit ${latest.limitMB.toFixed(0)} MB` : "Browser API unavailable"
          }
        />
        <StatCard
          icon={<Cpu className="h-4 w-4" />}
          label="Heap Growth"
          value={`${growthMB >= 0 ? "+" : ""}${growthMB.toFixed(1)} MB`}
          helper={`${sampleIntervalMs / 1000}s samples across rolling window`}
        />
        <StatCard
          icon={<Gauge className="h-4 w-4" />}
          label="Mounted Trackers"
          value={String(mountedComponents)}
          helper="Memory observer instances"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DefinitionCard
          label="Network Latency"
          value={wsPing ? `${Math.round(wsPing)}ms` : "--"}
          helper="Live socket round-trip via ping/pong"
        />
        <DefinitionCard
          label="API Latency"
          value={apiLatency ? `${Math.round(apiLatency)}ms` : "--"}
          helper="Live Axios request round-trip"
        />
        <DefinitionCard
          label="Orderbook UI Budget"
          value={`${ORDERBOOK_FLUSH_WINDOW_MS}ms`}
          helper="Derived from store batch flush window"
        />
        <DefinitionCard
          label="Chart Frame Budget"
          value={`${CHART_FRAME_BUDGET_MS.toFixed(1)}ms`}
          helper="Derived from 60 FPS render target"
        />
      </div>

      <div className="rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">
        <p>Live telemetry: FPS, frame time, socket RTT, API RTT, and browser heap usage.</p>
        <p className="mt-1">
          Derived budgets: orderbook updates batch every 50ms in the store, while chart updates target one visible frame at roughly 16.7ms.
        </p>
        {!isSupported && (
          <p className="mt-1 text-amber-400">
            Heap telemetry depends on the browser `performance.memory` API and may be unavailable outside Chromium-based browsers.
          </p>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  helper,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="font-mono text-lg font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{helper}</div>
    </div>
  );
}

function DefinitionCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-mono text-lg font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{helper}</div>
    </div>
  );
}
