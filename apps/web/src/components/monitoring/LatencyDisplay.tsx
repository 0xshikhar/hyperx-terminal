import { useMemo } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

export type LatencyData = {
  wsPing?: number;
  apiLatency?: number;
  lastUpdate?: number;
};

type LatencyDisplayProps = {
  showDetails?: boolean;
  className?: string;
};

export function LatencyDisplay({
  showDetails = false,
  className,
}: LatencyDisplayProps) {
  const isConnected = true;
  const latency = useMemo<LatencyData>(
    () => ({ wsPing: 28, apiLatency: 120 }),
    []
  );

  const getLatencyColor = (ms?: number) => {
    if (ms === undefined) return "text-muted-foreground";
    if (ms < 100) return "text-emerald-500";
    if (ms < 300) return "text-yellow-500";
    return "text-rose-500";
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {isConnected ? (
        <Wifi className="h-3 w-3 text-emerald-500" />
      ) : (
        <WifiOff className="h-3 w-3 text-rose-500" />
      )}

      <span className={cn("text-xs font-mono", getLatencyColor(latency.wsPing))}>
        {latency.wsPing ? `${Math.round(latency.wsPing)}ms` : "--"}
      </span>

      {showDetails && (
        <span className="text-xs text-muted-foreground">
          / API: {latency.apiLatency ? `${Math.round(latency.apiLatency)}ms` : "--"}
        </span>
      )}
    </div>
  );
}
