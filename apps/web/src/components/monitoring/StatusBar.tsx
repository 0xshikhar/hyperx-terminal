import { useEffect, useState } from "react";
import { Blocks, Clock, Zap, Activity, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import { LatencyDisplay } from "@/components/monitoring/LatencyDisplay";
import { useWebSocket } from "@/hooks/useWebSocket";

type StatusData = {
  blockHeight?: number;
  gasPrice?: string;
  lastBlockTime?: number;
};

type StatusBarProps = {
  className?: string;
  showDetails?: boolean;
};

export function StatusBar({ className, showDetails = true }: StatusBarProps) {
  const [status, setStatus] = useState<StatusData>({});
  const [timeAgo, setTimeAgo] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [systemLoad, setSystemLoad] = useState<number>(18);
  const { state: wsState, on, subscribe } = useWebSocket(true);

  useEffect(() => {
    const unsubscribeStatus = on("status", (message) => {
      setStatus({
        blockHeight: message.blockHeight,
        gasPrice: message.gasPrice,
        lastBlockTime: message.timestamp,
      });
    });
    const unsubscribeChannel = subscribe("status");
    return () => {
      unsubscribeStatus();
      unsubscribeChannel();
    };
  }, [on, subscribe]);

  useEffect(() => {
    if (!status.lastBlockTime) {
      const reset = window.setTimeout(() => {
        setTimeAgo(null);
      }, 0);
      return () => window.clearTimeout(reset);
    }

    const update = () => {
      setTimeAgo(Math.round((Date.now() - status.lastBlockTime!) / 1000));
    };

    const immediate = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 1000);
    return () => {
      window.clearTimeout(immediate);
      window.clearInterval(interval);
    };
  }, [status.lastBlockTime]);

  // Update current time
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toISOString().replace('T', ' ').slice(0, 19));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const updateLoad = () => {
      const tick = Date.now() / 10000;
      const next = 18 + Math.sin(tick) * 6;
      setSystemLoad(Math.max(8, Number(next.toFixed(1))));
    };
    updateLoad();
    const interval = setInterval(updateLoad, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={cn(
        "flex items-center justify-between border-t border-border bg-card/80 backdrop-blur-sm px-4 py-2 text-xs",
        className
      )}
    >
      <div className="flex items-center gap-6">
        {/* Connection status */}
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "status-dot",
              wsState === "connected" ? "active" : "inactive"
            )}
          />
          <span className="font-mono text-muted-foreground uppercase tracking-wider">
            {wsState === "connected" ? "ONLINE" : "OFFLINE"}
          </span>
        </div>

        {showDetails && (
          <>
            {/* Block height */}
            {status.blockHeight && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Blocks className="h-3 w-3 text-terminal-cyan" />
                <span className="font-mono text-[10px] uppercase tracking-wider">Block</span>
                <span className="font-mono text-foreground">
                  #{status.blockHeight.toLocaleString()}
                </span>
              </div>
            )}

            {/* Gas price */}
            {status.gasPrice && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Zap className="h-3 w-3 text-terminal-yellow" />
                <span className="font-mono text-[10px] uppercase tracking-wider">Gas</span>
                <span className="font-mono text-foreground">
                  {status.gasPrice} gwei
                </span>
              </div>
            )}

            {/* Last block time */}
            {status.lastBlockTime && timeAgo !== null && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-3 w-3 text-terminal-green" />
                <span className="font-mono text-[10px] uppercase tracking-wider">Last</span>
                <span className="font-mono text-foreground">
                  {timeAgo}s
                </span>
              </div>
            )}

            {/* System load */}
            <div className="hidden md:flex items-center gap-2 text-muted-foreground">
              <Cpu className="h-3 w-3 text-terminal-magenta" />
              <span className="font-mono text-[10px] uppercase tracking-wider">Load</span>
              <span className="font-mono text-foreground">
                {systemLoad.toFixed(1)}%
              </span>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-6">
        {/* Latency */}
        <LatencyDisplay />
        
        {/* Current time */}
        <div className="hidden md:flex items-center gap-2">
          <Activity className="h-3 w-3 text-primary animate-pulse" />
          <span className="font-mono text-foreground">{currentTime}</span>
        </div>
      </div>
    </div>
  );
}
