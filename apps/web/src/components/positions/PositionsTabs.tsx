import { useState } from "react";
import { useMarketStore } from "@/store/marketStore";
import { cn } from "@/lib/utils";
import { OpenPositionsTable } from "@/components/positions/OpenPositionsTable";
import { OpenOrdersTable } from "@/components/positions/OpenOrdersTable";
import { TradeHistoryTable } from "@/components/positions/TradeHistoryTable";
import { FundingHistoryTable } from "@/components/positions/FundingHistoryTable";

const TABS = [
  { id: "balances", label: "Balances" },
  { id: "positions", label: "Positions" },
  { id: "orders", label: "Open Orders" },
  { id: "twap", label: "TWAP" },
  { id: "trades", label: "Trade History" },
  { id: "funding", label: "Funding History" },
  { id: "history", label: "Order History" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function PositionsTabs() {
  const activeMarket = useMarketStore((state) => state.activeMarket);
  const [activeTab, setActiveTab] = useState<TabId>("positions");

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0d0d0f]">
      <div className="flex items-center border-b border-[#2a2a2e]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "relative px-4 py-3 text-xs font-medium transition-colors",
              activeTab === tab.id
                ? "text-white"
                : "text-[#6b6b74] hover:text-[#a0a0a8]"
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#00d084]" />
            )}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-4 px-4">
          <span className="text-xs text-[#6b6b74]">{activeMarket}</span>
          <button className="text-xs text-[#6b6b74] hover:text-[#d5dcde]">
            Filter
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-4">
        {activeTab === "balances" && (
          <EmptyState message="No spot balances available yet" />
        )}
        {activeTab === "positions" && <OpenPositionsTable />}
        {activeTab === "orders" && <OpenOrdersTable />}
        {activeTab === "twap" && <EmptyState message="No TWAP orders running" />}
        {activeTab === "trades" && <TradeHistoryTable />}
        {activeTab === "funding" && <FundingHistoryTable />}
        {activeTab === "history" && <EmptyState message="No historical orders recorded yet" />}
      </div>

      <div className="flex items-center justify-between border-t border-[#2a2a2e] bg-[#0d0d0f] px-4 py-2">
        <div className="flex items-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[#6b6b74]">Cross Margin</span>
            <span className="font-mono text-white">0.00</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#6b6b74]">Isolated Margin</span>
            <span className="font-mono text-white">0.00</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#6b6b74]">P&L (24h)</span>
            <span className="font-mono text-[#00d084]">+0.00</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded bg-[#1a1a1e] px-3 py-1.5 text-xs text-[#6b6b74] hover:bg-[#252529]">
            Cancel All
          </button>
          <button className="rounded bg-[#1a1a1e] px-3 py-1.5 text-xs text-[#6b6b74] hover:bg-[#252529]">
            Close All
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center text-[#6b6b74]">
      <p className="text-sm">{message}</p>
    </div>
  );
}
