import { useState } from "react";
import { cn } from "@/lib/utils";

type PositionRow = {
  market: string;
  size: number;
  entry: number;
  pnl: number;
};

const positions: PositionRow[] = [
  { market: "BTC-USD", size: 0.25, entry: 94200, pnl: 324.5 },
  { market: "ETH-USD", size: 3.1, entry: 4810, pnl: -128.2 },
];

const history: PositionRow[] = [
  { market: "STRK-USD", size: 1200, entry: 2.12, pnl: 86.9 },
];

export function PositionsTabs() {
  const [activeTab, setActiveTab] = useState<"open" | "history" | "funding">(
    "open"
  );

  const rows = activeTab === "history" ? history : positions;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Positions</h3>
        <div className="flex items-center gap-2 text-xs">
          {(["open", "history", "funding"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "rounded-md border px-2 py-1 uppercase",
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-border text-muted-foreground"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-2 text-xs font-mono">
        {rows.map((row) => (
          <div
            key={`${row.market}-${row.entry}`}
            className="flex items-center justify-between rounded-md border border-border px-3 py-2"
          >
            <span>{row.market}</span>
            <span>{row.size.toFixed(2)}</span>
            <span>{row.entry.toLocaleString()}</span>
            <span
              className={cn(
                row.pnl >= 0 ? "text-emerald-500" : "text-rose-500"
              )}
            >
              {row.pnl >= 0 ? "+" : ""}
              {row.pnl.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
