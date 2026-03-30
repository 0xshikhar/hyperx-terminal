import { useState, useEffect } from "react";
import { useIsPaperTrading } from "@/hooks/useIsPaperTrading";
import { usePaperTradingStore, type PaperTwapOrder } from "@/store/paperTradingStore";
import { useMarketStore } from "@/store/marketStore";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Play, X, Zap } from "lucide-react";
import { toast } from "sonner";

export function TWAPOrdersTable() {
  const isPaperTrading = useIsPaperTrading();
  const twapOrders = usePaperTradingStore((s) => s.twapOrders);
  const cancelTwapOrder = usePaperTradingStore((s) => s.cancelTwapOrder);
  const createTwapOrder = usePaperTradingStore((s) => s.createTwapOrder);
  const activeMarket = useMarketStore((s) => s.activeMarket);

  // Force re-render every second to update "Next Slice" countdown
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLaunchDemoTwap = () => {
    try {
      createTwapOrder({
        market: activeMarket,
        side: "buy",
        totalSize: 0.25,
        totalSlices: 5,
        intervalSeconds: 10,
        durationMinutes: 1,
      });
      toast.success(`Launched Paper TWAP Order: 0.25 ${activeMarket.split("-")[0]} in 5 slices`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to launch TWAP");
    }
  };

  if (twapOrders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-md border border-[#1a2830] bg-[#0c181b] px-4 py-8 text-center text-xs">
        <p className="text-[#64748b]">No active or historical TWAP orders running.</p>
        {isPaperTrading && (
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={handleLaunchDemoTwap}
              className="inline-flex items-center gap-1.5 rounded border border-[#1d4a50] bg-[#0e252a] px-3 py-1.5 text-xs font-semibold text-[#22d3ee] hover:bg-[#102c32] transition-colors"
            >
              <Zap className="h-3.5 w-3.5" />
              Launch Demo TWAP (0.25 {activeMarket.split("-")[0]}, 5 slices @ 10s)
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {isPaperTrading && (
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[#64748b]">
            TWAP slices execute market orders at regular time intervals to minimize price impact.
          </span>
          <button
            onClick={handleLaunchDemoTwap}
            className="inline-flex items-center gap-1 rounded border border-[#1d4a50] bg-[#0e252a] px-2.5 py-1 text-[11px] font-semibold text-[#22d3ee] hover:bg-[#102c32]"
          >
            <Play className="h-3 w-3" />
            + New Demo TWAP
          </button>
        </div>
      )}

      <div className="rounded-md border border-[#1a2830] bg-[#0c181b]">
        <Table className="text-xs">
          <TableHeader>
            <TableRow className="border-b border-[#1a2830] hover:bg-transparent">
              <TableHead className="text-[10px] uppercase font-mono text-[#64748b]">Market</TableHead>
              <TableHead className="text-[10px] uppercase font-mono text-[#64748b]">Side</TableHead>
              <TableHead className="text-[10px] uppercase font-mono text-[#64748b]">Total Size</TableHead>
              <TableHead className="text-[10px] uppercase font-mono text-[#64748b]">Progress</TableHead>
              <TableHead className="text-[10px] uppercase font-mono text-[#64748b]">Slices</TableHead>
              <TableHead className="text-[10px] uppercase font-mono text-[#64748b]">Interval</TableHead>
              <TableHead className="text-[10px] uppercase font-mono text-[#64748b]">Next Execution</TableHead>
              <TableHead className="text-[10px] uppercase font-mono text-[#64748b]">Status</TableHead>
              <TableHead className="text-right text-[10px] uppercase font-mono text-[#64748b]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {twapOrders.map((order: PaperTwapOrder) => {
              const progressPercent =
                order.totalSize > 0
                  ? Math.min(100, Math.round((order.executedSize / order.totalSize) * 100))
                  : 0;

              const remainingSec = Math.max(0, Math.ceil((order.nextSliceAt - Date.now()) / 1000));

              return (
                <TableRow key={order.id} className="border-b border-[#142228] hover:bg-[#112025]/50 font-mono">
                  <TableCell className="font-semibold text-white">{order.market}</TableCell>
                  <TableCell
                    className={cn(
                      "uppercase font-medium",
                      order.side === "buy" ? "text-[#00d084]" : "text-[#ff4757]"
                    )}
                  >
                    {order.side}
                  </TableCell>
                  <TableCell className="text-white">{order.totalSize.toFixed(4)}</TableCell>
                  <TableCell className="min-w-[120px]">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-[#152327]">
                        <div
                          className="h-full rounded-full bg-[#22d3ee] transition-all duration-300"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-[#8ea4a9]">{progressPercent}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-[#c8d4d7]">
                    {order.executedSlices} / {order.totalSlices} ({order.sliceSize} per slice)
                  </TableCell>
                  <TableCell className="text-[#8ea4a9]">{order.intervalSeconds}s</TableCell>
                  <TableCell className="text-[#c8d4d7]">
                    {order.status === "running" ? `${remainingSec}s` : "--"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                        order.status === "running"
                          ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"
                          : order.status === "completed"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-[#1a2830] text-[#8ea4a9]"
                      )}
                    >
                      {order.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {order.status === "running" && (
                      <button
                        onClick={() => {
                          cancelTwapOrder(order.id);
                          toast.info(`Cancelled TWAP order ${order.id}`);
                        }}
                        className="inline-flex items-center gap-1 rounded border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-300 hover:bg-rose-500/20"
                      >
                        <X className="h-2.5 w-2.5" />
                        Cancel
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
