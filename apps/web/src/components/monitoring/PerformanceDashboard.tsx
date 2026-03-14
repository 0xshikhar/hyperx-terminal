import { Cpu, Gauge, MemoryStick } from "lucide-react";
import { PerformancePanel } from "@/components/monitoring/FPSCounter";
import { LatencyGraph } from "@/components/monitoring/LatencyGraph";
import { useMemoryTracker } from "@/hooks/useMemoryTracker";

export function PerformanceDashboard() {
  const { latest, growthMB, mountedComponents } = useMemoryTracker();

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Gauge className="h-4 w-4" />
          Performance Dashboard
        </h2>
        <span className="text-xs text-muted-foreground">Live telemetry</span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr,1fr]">
        <PerformancePanel />
        <LatencyGraph />
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
          helper="30-sample rolling window"
        />
        <StatCard
          icon={<Gauge className="h-4 w-4" />}
          label="Mounted Trackers"
          value={String(mountedComponents)}
          helper="Memory observer instances"
        />
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
  icon: React.ReactNode;
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
