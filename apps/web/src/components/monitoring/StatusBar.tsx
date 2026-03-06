import { useEffect, useState } from "react";
import { Blocks, Clock, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { LatencyDisplay } from "@/components/monitoring/LatencyDisplay";
import { useWebSocket } from "@/hooks/useWebSocket";

type StatusData = {
  blockHeight?: number;
  gasPrice?: string;
  connected?: boolean;
  lastBlockTime?: number;
};

type StatusBarProps = {
  className?: string;
  showDetails?: boolean;
};

export function StatusBar({ className, showDetails = true }: StatusBarProps) {
  const [status, setStatus] = useState<StatusData>({
    connected: true,
  });
  const [timeAgo, setTimeAgo] = useState<number | null>(null);
  
  useWebSocket(true);

  useEffect(() => {
    const ws = (window as Window & { __ws?: WebSocket }).__ws;

    const handleStatusUpdate = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "status") {
          setStatus((prev) => ({
            ...prev,
            blockHeight: data.blockHeight,
            gasPrice: data.gasPrice,
            lastBlockTime: data.timestamp,
          }));
        }
      } catch {
        return;
      }
    };

    if (ws) {
      ws.addEventListener("message", handleStatusUpdate);
      return () => ws.removeEventListener("message", handleStatusUpdate);
    }
    return undefined;
  }, []);

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

  return (
    <div
      className={cn(
        "flex items-center justify-between border-t border-border bg-secondary/50 px-3 py-1.5 text-xs",
        className
      )}
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div
            className={cn(
              "h-2 w-2 rounded-full",
              status.connected ? "bg-emerald-500" : "bg-rose-500"
            )}
          />
          <span className="text-muted-foreground">
            {status.connected ? "Connected" : "Disconnected"}
          </span>
        </div>

        {showDetails && (
          <>
            {status.blockHeight && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Blocks className="h-3 w-3" />
                <span>#{status.blockHeight.toLocaleString()}</span>
              </div>
            )}

            {status.gasPrice && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Zap className="h-3 w-3" />
                <span>{status.gasPrice} gwei</span>
              </div>
            )}

            {status.lastBlockTime && timeAgo !== null && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{timeAgo}s ago</span>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-4">
        <LatencyDisplay />
      </div>
    </div>
  );
}
