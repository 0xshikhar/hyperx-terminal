import { AlertTriangle, Cpu, PlugZap, Radio, Wifi } from "lucide-react";
import { useMemoryTracker } from "@/hooks/useMemoryTracker";
import { useLatencyStore } from "@/store/latencyStore";
import { useMarketStore } from "@/store/marketStore";
import { useRenderMetricsStore } from "@/store/renderMetricsStore";
import { useRuntimeHealthStore } from "@/store/runtimeHealthStore";
import { cn } from "@/lib/utils";

type IncidentConsoleProps = {
  compact?: boolean;
};

export function IncidentConsole({ compact = false }: IncidentConsoleProps) {
  const activeMarket = useMarketStore((state) => state.activeMarket);
  const { wsPing, apiLatency } = useLatencyStore((state) => state.latency);
  const { fps, frameTime } = useRenderMetricsStore();
  const { latest, growthMB } = useMemoryTracker();
  const connectionState = useRuntimeHealthStore((state) => state.connectionState);
  const reconnectCount = useRuntimeHealthStore((state) => state.reconnectCount);
  const reconnectPlan = useRuntimeHealthStore((state) => state.reconnectPlan);
  const lastDisconnect = useRuntimeHealthStore((state) => state.lastDisconnect);
  const lastPongAt = useRuntimeHealthStore((state) => state.lastPongAt);
  const getMarketFeedHealth = useRuntimeHealthStore((state) => state.getMarketFeedHealth);
  const feedHealth = getMarketFeedHealth(activeMarket);

  const socketStatus =
    connectionState === "connected"
      ? (wsPing ?? 0) > 250
        ? "degraded"
        : "healthy"
      : connectionState === "connecting"
        ? "recovering"
        : "offline";

  const renderStatus = fps >= 55 && frameTime <= 20 ? "healthy" : fps >= 40 ? "degraded" : "critical";
  const memoryStatus =
    latest && latest.limitMB !== null && latest.limitMB > 0 && latest.usedMB / latest.limitMB > 0.75
      ? "critical"
      : growthMB > 10
        ? "degraded"
        : "healthy";
  const feedStatus = feedHealth.isFresh ? "healthy" : connectionState === "connected" ? "critical" : "offline";

  const cards: Array<{
    label: string;
    icon: JSX.Element;
    status: "healthy" | "degraded" | "critical" | "recovering" | "offline";
    value: string;
    helper: string;
  }> = [
    {
      label: "Socket",
      icon: <Wifi className="h-4 w-4" />,
      status: socketStatus,
      value:
        connectionState === "connected"
          ? `${Math.round(wsPing || 0)}ms RTT`
          : connectionState === "connecting"
            ? "Reconnecting"
            : "Offline",
      helper:
        connectionState === "connecting" && reconnectPlan
          ? `Retry ${reconnectPlan.attempt} in ${Math.max(0, Math.ceil((reconnectPlan.reconnectAt - Date.now()) / 1000))}s`
          : reconnectCount > 0
            ? `${reconnectCount} reconnects this session`
            : "Stable session",
    },
    {
      label: "Feed",
      icon: <Radio className="h-4 w-4" />,
      status: feedStatus,
      value: feedHealth.isFresh ? `${activeMarket} fresh` : `${activeMarket} stale`,
      helper:
        feedHealth.ageMs === null
          ? connectionState === "connected"
            ? "Awaiting live market events"
            : "Feed paused with socket"
          : `${Math.round(feedHealth.ageMs / 1000)}s since market event`,
    },
    {
      label: "Render",
      icon: <Cpu className="h-4 w-4" />,
      status: renderStatus,
      value: `${fps} FPS / ${frameTime.toFixed(1)}ms`,
      helper: apiLatency ? `API ${Math.round(apiLatency)}ms` : "Render path healthy",
    },
    {
      label: "Memory",
      icon: <PlugZap className="h-4 w-4" />,
      status: memoryStatus,
      value: latest ? `${latest.usedMB.toFixed(1)} MB` : "Unavailable",
      helper: latest ? `${growthMB >= 0 ? "+" : ""}${growthMB.toFixed(1)} MB window` : "Browser memory API unavailable",
    },
  ];

  if (lastDisconnect) {
    cards[1] = {
      ...cards[1],
      helper: feedHealth.ageMs === null
        ? `Last disconnect ${lastDisconnect.code}${lastDisconnect.reason ? `: ${lastDisconnect.reason}` : ""}`
        : cards[1].helper,
    };
  }

  if (connectionState === "connected" && lastPongAt) {
    cards[0] = {
      ...cards[0],
      helper: `Last pong ${Math.max(0, Math.round((Date.now() - lastPongAt) / 1000))}s ago`,
    };
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card",
        compact ? "p-3" : "p-4"
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <AlertTriangle className="h-4 w-4" />
          Incident Console
        </div>
        <div className="text-xs text-muted-foreground">
          Minimum dashboard for stale feed vs system pressure
        </div>
      </div>
      <div className={cn("grid gap-3", compact ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-2 xl:grid-cols-4")}>
        {cards.map((card) => (
          <div key={card.label} className="rounded-md border border-border bg-background p-3">
            <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <span className={statusClass(card.status)}>{card.icon}</span>
              {card.label}
            </div>
            <div className={cn("font-mono text-sm font-semibold", statusClass(card.status))}>{card.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{card.helper}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function statusClass(status: "healthy" | "degraded" | "critical" | "recovering" | "offline") {
  switch (status) {
    case "healthy":
      return "text-emerald-400";
    case "degraded":
    case "recovering":
      return "text-amber-400";
    case "critical":
    case "offline":
      return "text-rose-400";
  }
}
