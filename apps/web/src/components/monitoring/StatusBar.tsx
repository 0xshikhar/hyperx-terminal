import { useEffect, useState } from "react";
import { Blocks, Clock, Zap, Activity, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { LatencyDisplay } from "@/components/monitoring/LatencyDisplay";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useMarketStore } from "@/store/marketStore";
import { useTradingModeStore } from "@/store/tradingModeStore";
import { useRuntimeHealthStore } from "@/store/runtimeHealthStore";

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
  const activeMarket = useMarketStore((state) => state.activeMarket);
  const tradingMode = useTradingModeStore((state) => state.mode);
  const [status, setStatus] = useState<StatusData>({});
  const [timeAgo, setTimeAgo] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState<string>("");
  const { state: wsState, on, subscribe } = useWebSocket(true);
  const reconnectCount = useRuntimeHealthStore((state) => state.reconnectCount);
  const reconnectPlan = useRuntimeHealthStore((state) => state.reconnectPlan);
  const lastPongAt = useRuntimeHealthStore((state) => state.lastPongAt);
  const getMarketFeedHealth = useRuntimeHealthStore((state) => state.getMarketFeedHealth);
  const feedHealth = getMarketFeedHealth(activeMarket);

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
              wsState === "connected"
                ? "active"
                : wsState === "connecting"
                  ? "active"
                  : "inactive"
            )}
          />
          <span className="font-mono text-muted-foreground uppercase tracking-wider">
            {wsState === "connected" ? "ONLINE" : wsState === "connecting" ? "RECOVERING" : "OFFLINE"}
          </span>
        </div>

        {/* Trading mode indicator */}
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              tradingMode === "real" ? "bg-emerald-400" : tradingMode === "paper" ? "bg-amber-400" : "bg-rose-400"
            )}
          />
          <span className="font-mono text-muted-foreground uppercase tracking-wider text-[10px]">
            {tradingMode === "real" ? "LIVE" : tradingMode === "paper" ? "PAPER" : "DEMO"}
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

            <div className="hidden md:flex items-center gap-2 text-muted-foreground">
              <RefreshCw
                className={cn(
                  "h-3 w-3",
                  reconnectPlan ? "animate-spin text-terminal-yellow" : "text-terminal-magenta"
                )}
              />
              <span className="font-mono text-[10px] uppercase tracking-wider">
                {reconnectPlan ? "Retry" : "Pong"}
              </span>
              <span className="font-mono text-foreground">
                {reconnectPlan
                  ? `${Math.max(0, Math.ceil((reconnectPlan.reconnectAt - Date.now()) / 1000))}s`
                  : lastPongAt
                    ? `${Math.max(0, Math.round((Date.now() - lastPongAt) / 1000))}s`
                    : "--"}
              </span>
            </div>

            <div className="hidden xl:flex items-center gap-2 text-muted-foreground">
              <Activity
                className={cn(
                  "h-3 w-3",
                  feedHealth.isFresh ? "text-terminal-green" : "text-terminal-yellow"
                )}
              />
              <span className="font-mono text-[10px] uppercase tracking-wider">Feed</span>
              <span className="font-mono text-foreground">
                {feedHealth.isFresh
                  ? `${activeMarket} live`
                  : wsState === "connected"
                    ? `${activeMarket} stale`
                    : "paused"}
              </span>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-6">
        {/* Latency */}
        <LatencyDisplay />

        <div className="hidden lg:flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>Reconnects</span>
          <span className={cn("text-foreground", reconnectCount > 2 && "text-amber-400")}>
            {reconnectCount}
          </span>
        </div>
        
        {/* Current time */}
        <div className="hidden md:flex items-center gap-2">
          <Activity className="h-3 w-3 text-primary animate-pulse" />
          <span className="font-mono text-foreground">{currentTime}</span>
        </div>
      </div>
    </div>
  );
}
