import { useState } from "react";
import { useMarketStore } from "@/store/marketStore";
import { cn } from "@/lib/utils";
import { Wallet, Plug, ArrowRight, PlusCircle, RotateCcw } from "lucide-react";
import { OpenPositionsTable } from "@/components/positions/OpenPositionsTable";
import { OpenOrdersTable } from "@/components/positions/OpenOrdersTable";
import { TradeHistoryTable } from "@/components/positions/TradeHistoryTable";
import { FundingHistoryTable } from "@/components/positions/FundingHistoryTable";
import { useWallet } from "@/components/wallet/useWallet";
import { useNetworkStore } from "@/store/networkStore";
import { usePaperTradingStore } from "@/store/paperTradingStore";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { toast } from "sonner";

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
  const isWalletConnected = useWallet((state) => state.isConnected);
  const isPaperWallet = useWallet((state) => state.isPaperWallet);
  const { setModalOpen } = useWallet();
  const isPaperTrading = useNetworkStore((s) => s.isPaperTrading) || isPaperWallet;
  const hasAccess = isWalletConnected || isPaperTrading;

  // Paper trading data
  const paperBalance = usePaperTradingStore((s) => s.balance);
  const paperPositions = usePaperTradingStore((s) => s.positions);
  const paperOrders = usePaperTradingStore((s) => s.openOrders);
  const closePaperPosition = usePaperTradingStore((s) => s.closePosition);
  const cancelPaperOrder = usePaperTradingStore((s) => s.cancelOrder);
  const faucet = usePaperTradingStore((s) => s.faucet);
  const resetAccount = usePaperTradingStore((s) => s.resetAccount);

  const paperMarginUsed = paperPositions.reduce((acc, p) => acc + p.margin, 0);
  const paperPnl = paperPositions.reduce((acc, p) => acc + p.pnl, 0);
  const paperEquity = paperBalance + paperMarginUsed + paperPnl;

  const handleCloseAll = () => {
    if (isPaperTrading) {
      if (paperPositions.length === 0) {
        toast.info("No open paper positions to close");
        return;
      }
      const count = paperPositions.length;
      paperPositions.forEach((p) => closePaperPosition(p.id));
      toast.success(`Closed all ${count} paper position(s)`);
    }
  };

  const handleCancelAll = () => {
    if (isPaperTrading) {
      if (paperOrders.length === 0) {
        toast.info("No open paper orders to cancel");
        return;
      }
      const count = paperOrders.length;
      paperOrders.forEach((o) => cancelPaperOrder(o.id));
      toast.info(`Cancelled ${count} paper order(s)`);
    }
  };

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
            {tab.id === "positions" && paperPositions.length > 0 && (
              <span className="ml-1.5 rounded bg-cyan-500/20 px-1.5 py-0.2 text-[10px] font-mono text-cyan-300">
                {paperPositions.length}
              </span>
            )}
            {tab.id === "orders" && paperOrders.length > 0 && (
              <span className="ml-1.5 rounded bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-mono text-amber-300">
                {paperOrders.length}
              </span>
            )}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00d084]" />
            )}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-4 px-4">
          <span className="text-xs text-[#6b6b74]">{activeMarket}</span>
          {isPaperTrading && (
            <span className="rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-cyan-300">
              ⚡ Paper Sim
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-4">
        {!hasAccess ? (
          <div className="flex h-full items-center justify-center">
            <div className="mx-auto max-w-sm rounded-lg border border-[#2a2a2e] bg-[#111315] p-8 text-center shadow-lg">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#1a3a3a]">
                <Plug className="h-7 w-7 text-[#53d8c8]" />
              </div>
              <h3 className="text-lg font-semibold text-white">Wallet Required</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#8a9294]">
                Connect your Starknet wallet or launch an Instant Paper Wallet with $10,000 virtual USDC to view positions and trading history.
              </p>
              <button
                onClick={() => setModalOpen(true)}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#53d8c8] px-6 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[#45c0b0]"
              >
                <Wallet className="h-4 w-4" />
                Connect Wallet
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <>
            {activeTab === "balances" && (
              isPaperTrading ? (
                <div className="space-y-4 max-w-2xl">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded-lg border border-[#213136] bg-[#0c181b] p-3">
                      <div className="text-[10px] uppercase text-[#708084]">Available Cash</div>
                      <div className="mt-1 text-base font-bold font-mono text-white">
                        ${paperBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] text-cyan-400">Virtual USDC</div>
                    </div>

                    <div className="rounded-lg border border-[#213136] bg-[#0c181b] p-3">
                      <div className="text-[10px] uppercase text-[#708084]">Used Margin</div>
                      <div className="mt-1 text-base font-bold font-mono text-white">
                        ${paperMarginUsed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] text-[#708084]">{paperPositions.length} active position(s)</div>
                    </div>

                    <div className="rounded-lg border border-[#213136] bg-[#0c181b] p-3">
                      <div className="text-[10px] uppercase text-[#708084]">Unrealized PnL</div>
                      <div className={cn(
                        "mt-1 text-base font-bold font-mono",
                        paperPnl >= 0 ? "text-emerald-400" : "text-rose-400"
                      )}>
                        {paperPnl >= 0 ? "+" : ""}${paperPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] text-[#708084]">Mark to Market</div>
                    </div>

                    <div className="rounded-lg border border-[#213136] bg-[#0c181b] p-3">
                      <div className="text-[10px] uppercase text-[#708084]">Total Equity</div>
                      <div className="mt-1 text-base font-bold font-mono text-white">
                        ${paperEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] text-cyan-400">Cash + Margin + PnL</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={() => {
                        faucet(10000);
                        toast.success("Added $10,000 virtual USDC");
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20"
                    >
                      <PlusCircle className="h-3.5 w-3.5" />
                      Faucet (+$10,000 USDC)
                    </button>
                    <button
                      onClick={() => {
                        resetAccount();
                        toast.info("Paper account reset to $10,000 USDC");
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#213136] bg-[#121c1f] px-4 py-2 text-xs font-medium text-[#8ea4a9] hover:text-white hover:bg-[#1a292d]"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reset to $10,000
                    </button>
                  </div>
                </div>
              ) : (
                <EmptyState message="No spot balances available yet on this network" />
              )
            )}
            {activeTab === "positions" && <OpenPositionsTable />}
            {activeTab === "orders" && <OpenOrdersTable />}
            {activeTab === "twap" && <EmptyState message="No TWAP orders running" />}
            {activeTab === "trades" && <TradeHistoryTable />}
            {activeTab === "funding" && <FundingHistoryTable />}
            {activeTab === "history" && <EmptyState message="No historical orders recorded yet" />}
          </>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-[#2a2a2e] bg-[#0d0d0f] px-4 py-2">
        {hasAccess ? (
          <>
            <div className="flex items-center gap-6 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[#6b6b74]">Cross Margin</span>
                <span className="font-mono text-white">
                  {isPaperTrading ? `$${paperMarginUsed.toFixed(2)}` : "0.00"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#6b6b74]">Available</span>
                <span className="font-mono text-white">
                  {isPaperTrading ? `$${paperBalance.toFixed(2)}` : "0.00"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#6b6b74]">P&L</span>
                <span className={cn(
                  "font-mono",
                  isPaperTrading
                    ? paperPnl >= 0 ? "text-[#00d084]" : "text-[#ff4757]"
                    : "text-[#00d084]"
                )}>
                  {isPaperTrading ? `${paperPnl >= 0 ? "+" : ""}$${paperPnl.toFixed(2)}` : "+0.00"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancelAll}
                className="rounded bg-[#1a1a1e] px-3 py-1.5 text-xs text-[#6b6b74] hover:bg-[#252529] hover:text-white transition-colors"
              >
                Cancel All
              </button>
              <button
                onClick={handleCloseAll}
                className="rounded bg-[#1a1a1e] px-3 py-1.5 text-xs text-[#6b6b74] hover:bg-[#252529] hover:text-white transition-colors"
              >
                Close All
              </button>
            </div>
          </>
        ) : (
          <div className="flex w-full items-center justify-between gap-3">
            <div className="text-xs text-[#6b6b74]">Wallet not connected</div>
            <ConnectWalletButton />
          </div>
        )}
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
