import {
  Gauge,
  MemoryStick,
  Activity,
  Wifi,
  Server,
  Layers,
  Clock,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemoryTracker } from "@/hooks/useMemoryTracker";
import { useMarketStore } from "@/store/marketStore";
import { useLatencyStore } from "@/store/latencyStore";
import { FLUSH_WINDOW_MS, useOrderbookStore } from "@/store/orderbookStore";
import { useRenderMetricsStore } from "@/store/renderMetricsStore";
import { useRuntimeHealthStore } from "@/store/runtimeHealthStore";

const CHART_FRAME_BUDGET_MS = 16.7;
const TARGET_FPS = 60;

export function PerformanceDashboard() {
  const { latest, growthMB, mountedComponents, isSupported } = useMemoryTracker();
  const { wsPing, apiLatency } = useLatencyStore((s) => s.latency);
  const activeMarket = useMarketStore((state) => state.activeMarket);
  const pendingBatchDepth = useOrderbookStore((state) => state.pendingBatchDepth);
  const lastBatchSize = useOrderbookStore((state) => state.lastBatchSize);
  const lastAppliedAt = useOrderbookStore((state) => state.lastAppliedAt);
  const lastApplyDurationMs = useOrderbookStore((state) => state.lastApplyDurationMs);
  const frameTime = useRenderMetricsStore((state) => state.frameTime);
  const fps = useRenderMetricsStore((state) => state.fps);
  const droppedFrames = useRenderMetricsStore((state) => state.droppedFrames);
  const getMarketFeedHealth = useRuntimeHealthStore((state) => state.getMarketFeedHealth);
  const feedHealth = getMarketFeedHealth(activeMarket);

  // Calculate derived metrics
  const currentFPS = fps ?? 0;
  const isPerformanceGood = currentFPS >= 55 && frameTime < CHART_FRAME_BUDGET_MS;
  const latencyStatus = wsPing && wsPing < 100 ? "good" : wsPing && wsPing < 300 ? "fair" : "poor";

  return (
    <div className="space-y-3">
      {/* Top Row: Core Performance Metrics */}
      <div className="grid grid-cols-5 gap-2">
        <CompactMetric
          icon={Gauge}
          label="FPS"
          value={currentFPS.toString()}
          status={isPerformanceGood ? "good" : currentFPS >= 30 ? "fair" : "poor"}
          suffix={`/${TARGET_FPS}`}
        />
        <CompactMetric
          icon={Clock}
          label="Frame"
          value={`${frameTime.toFixed(1)}ms`}
          status={frameTime < 16.7 ? "good" : frameTime < 33 ? "fair" : "poor"}
        />
        <CompactMetric
          icon={Zap}
          label="Dropped"
          value={droppedFrames.toString()}
          status={droppedFrames === 0 ? "good" : droppedFrames < 10 ? "fair" : "poor"}
        />
        <CompactMetric
          icon={Wifi}
          label="WS RTT"
          value={wsPing ? `${Math.round(wsPing)}ms` : "--"}
          status={latencyStatus}
        />
        <CompactMetric
          icon={Server}
          label="API"
          value={apiLatency ? `${Math.round(apiLatency)}ms` : "--"}
          status={apiLatency && apiLatency < 200 ? "good" : apiLatency && apiLatency < 500 ? "fair" : "poor"}
        />
      </div>

      {/* Second Row: Memory & System */}
      <div className="grid grid-cols-4 gap-2">
        <CompactMetric
          icon={MemoryStick}
          label="Heap"
          value={latest ? `${latest.usedMB.toFixed(1)}MB` : "--"}
          status={latest && latest.limitMB && latest.usedMB < latest.limitMB * 0.8 ? "good" : "fair"}
        />
        <CompactMetric
          icon={Activity}
          label="Growth"
          value={`${growthMB >= 0 ? "+" : ""}${growthMB.toFixed(1)}MB`}
          status={growthMB < 10 ? "good" : growthMB < 50 ? "fair" : "poor"}
        />
        <CompactMetric
          icon={Layers}
          label="Trackers"
          value={String(mountedComponents)}
          status="neutral"
        />
        <CompactMetric
          icon={Gauge}
          label="Feed"
          value={feedHealth.isFresh ? "Live" : `${Math.round((feedHealth.ageMs ?? 0) / 1000)}s`}
          status={feedHealth.isFresh ? "good" : "fair"}
        />
      </div>

      {/* Third Row: Pipeline Metrics */}
      <div className="grid grid-cols-4 gap-2">
        <CompactMetric
          icon={Clock}
          label="UI Budget"
          value={`${FLUSH_WINDOW_MS}ms`}
          status="neutral"
        />
        <CompactMetric
          icon={Clock}
          label="Frame Budget"
          value={`${CHART_FRAME_BUDGET_MS.toFixed(1)}ms`}
          status="neutral"
        />
        <CompactMetric
          icon={Layers}
          label="Queue"
          value={String(pendingBatchDepth)}
          status={pendingBatchDepth === 0 ? "good" : pendingBatchDepth < 10 ? "fair" : "poor"}
        />
        <CompactMetric
          icon={Zap}
          label="Flush→Paint"
          value={lastApplyDurationMs ? `${lastApplyDurationMs.toFixed(1)}ms` : "--"}
          status={lastApplyDurationMs && lastApplyDurationMs < 8 ? "good" : lastApplyDurationMs && lastApplyDurationMs < 16 ? "fair" : "poor"}
        />
      </div>

      {/* Compact Status Bar */}
      <div className="flex items-center justify-between rounded border border-[#162326] bg-[#0c181b] px-3 py-2 text-xs">
        <div className="flex items-center gap-4">
          <span className="text-[#708084]">
            Last flush: {lastBatchSize > 0 ? `${lastBatchSize} updates` : "idle"}
          </span>
          <span className="text-[#708084]">
            Store apply: {lastAppliedAt ? "Active" : "--"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn(
            "h-2 w-2 rounded-full",
            isPerformanceGood ? "bg-[#53d8c8]" : currentFPS >= 30 ? "bg-[#f7c96b]" : "bg-[#f16d75]"
          )} />
          <span className={cn(
            isPerformanceGood ? "text-[#53d8c8]" : currentFPS >= 30 ? "text-[#f7c96b]" : "text-[#f16d75]"
          )}>
            {isPerformanceGood ? "Optimal" : currentFPS >= 30 ? "Acceptable" : "Degraded"}
          </span>
        </div>
      </div>

      {!isSupported && (
        <p className="text-[10px] text-amber-400">
          Heap telemetry unavailable. Enable in Chromium-based browsers.
        </p>
      )}
    </div>
  );
}

function CompactMetric({
  icon: Icon,
  label,
  value,
  status,
  suffix,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
  status: "good" | "fair" | "poor" | "neutral";
  suffix?: string;
}) {
  const statusColors = {
    good: "text-[#53d8c8]",
    fair: "text-[#f7c96b]",
    poor: "text-[#f16d75]",
    neutral: "text-white",
  };

  const bgColors = {
    good: "bg-[#0f2523] border-[#1d4d49]",
    fair: "bg-[#261f10] border-[#5a4a1f]",
    poor: "bg-[#2a1515] border-[#5a2f2f]",
    neutral: "bg-[#0c181b] border-[#162326]",
  };

  return (
    <div className={cn("rounded border px-2 py-1.5", bgColors[status])}>
      <div className="flex items-center gap-1">
        <Icon className="h-3 w-3 text-[#708084]" />
        <span className="text-[10px] uppercase tracking-wide text-[#708084]">{label}</span>
      </div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className={cn("font-mono text-sm font-semibold", statusColors[status])}>
          {value}
        </span>
        {suffix && <span className="text-[10px] text-[#708084]">{suffix}</span>}
      </div>
    </div>
  );
}
