import { useState } from "react";
import { useMarketStore } from "@/store/marketStore";
import { cn } from "@/lib/utils";
import { Wallet, Plug, ArrowRight, PlusCircle, RotateCcw, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { OpenPositionsTable } from "@/components/positions/OpenPositionsTable";
import { OpenOrdersTable } from "@/components/positions/OpenOrdersTable";
import { TradeHistoryTable } from "@/components/positions/TradeHistoryTable";
import { FundingHistoryTable } from "@/components/positions/FundingHistoryTable";
import { OrderHistoryTable } from "@/components/positions/OrderHistoryTable";
import { TWAPOrdersTable } from "@/components/positions/TWAPOrdersTable";
import { useWallet } from "@/components/wallet/useWallet";
import { useIsPaperTrading } from "@/hooks/useIsPaperTrading";
import { usePaperTradingStore } from "@/store/paperTradingStore";
import { usePositions } from "@/hooks/usePositions";
import { useOrdersStore } from "@/store/ordersStore";
import { useStarkzapBalance } from "@/hooks/useStarkzapBalance";
import { getAccountSummary } from "@/services/apiClient/account.api";
import { useQuery } from "@tanstack/react-query";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { AccountRiskHUD } from "@/components/risk/AccountRiskHUD";
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
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isWalletConnected = useWallet((state) => state.isConnected);
  const walletAddress = useWallet((state) => state.address);
  const { setModalOpen } = useWallet();
  const isPaperTrading = useIsPaperTrading();
  const hasAccess = isWalletConnected || isPaperTrading;

  // Paper trading data
  const paperBalance = usePaperTradingStore((s) => s.balance);
  const paperPositions = usePaperTradingStore((s) => s.positions);
  const paperOrders = usePaperTradingStore((s) => s.openOrders);
  const paperTwapOrders = usePaperTradingStore((s) => s.twapOrders);
  const runningPaperTwapsCount = paperTwapOrders.filter((t) => t.status === "running").length;
  const closePaperPosition = usePaperTradingStore((s) => s.closePosition);
  const cancelPaperOrder = usePaperTradingStore((s) => s.cancelOrder);
  const faucet = usePaperTradingStore((s) => s.faucet);
  const resetAccount = usePaperTradingStore((s) => s.resetAccount);

  // Live trading data
  const { positions: realPositions } = usePositions();
  const realOrders = useOrdersStore((s) => s.openOrders);
  const markOrderCancelled = useOrdersStore((s) => s.markOrderCancelled);
  const strkBalance = useStarkzapBalance();
  const { data: realAccount } = useQuery({
    queryKey: ["account-summary"],
    queryFn: getAccountSummary,
    enabled: !isPaperTrading && isWalletConnected,
    staleTime: 15_000,
  });

  const paperMarginUsed = paperPositions.reduce((acc, p) => acc + p.margin, 0);
  const paperPnl = paperPositions.reduce((acc, p) => acc + p.pnl, 0);
  const paperEquity = paperBalance + paperMarginUsed + paperPnl;

  const realMarginUsed = realAccount?.marginUsed ?? 0;
  const realPnl = realAccount?.unrealizedPnl ?? 0;
  const realAvailable = realAccount?.available ?? 0;

  const handleCloseAll = () => {
    if (isPaperTrading) {
      if (paperPositions.length === 0) {
        toast.info("No open paper positions to close");
        return;
      }
      const count = paperPositions.length;
      paperPositions.forEach((p) => closePaperPosition(p.id));
      toast.success(`Closed all ${count} paper position(s)`);
    } else {
      if (!realPositions || realPositions.length === 0) {
        toast.info("No open live positions to close");
        return;
      }
      toast.info(`Requesting market close for ${realPositions.length} live position(s)...`);
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
    } else {
      if (realOrders.length === 0) {
        toast.info("No open live orders to cancel");
        return;
      }
      realOrders.forEach((o) => markOrderCancelled(o.id));
      toast.info(`Cancelled ${realOrders.length} live order(s)`);
    }
  };

  return (
    <div className={cn("flex min-h-0 flex-col bg-[#091416]", isCollapsed ? "h-9" : "h-[240px]")}>
      <div className="flex items-center border-b border-[#1a2830] bg-[#0a1518]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              if (isCollapsed) setIsCollapsed(false);
            }}
            className={cn(
              "relative px-3 py-2 text-xs font-medium transition-colors",
              activeTab === tab.id
                ? "text-white"
                : "text-[#64748b] hover:text-[#c8d4d7]"
            )}
          >
            {tab.label}
            {tab.id === "positions" && (isPaperTrading ? paperPositions.length : (realPositions?.length ?? 0)) > 0 && (
              <span className="ml-1.5 rounded bg-cyan-500/20 px-1.5 py-0.2 text-[10px] font-mono text-cyan-300">
                {isPaperTrading ? paperPositions.length : realPositions.length}
              </span>
            )}
            {tab.id === "orders" && (isPaperTrading ? paperOrders.length : realOrders.length) > 0 && (
              <span className="ml-1.5 rounded bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-mono text-amber-300">
                {isPaperTrading ? paperOrders.length : realOrders.length}
              </span>
            )}
            {tab.id === "twap" && runningPaperTwapsCount > 0 && (
              <span className="ml-1.5 rounded bg-cyan-500/20 px-1.5 py-0.2 text-[10px] font-mono text-cyan-300">
                {runningPaperTwapsCount}
              </span>
            )}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#22d3ee]" />
            )}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3 px-3">
          <span className="font-mono text-xs text-[#64748b]">{activeMarket}</span>
          {isPaperTrading && (
            <span className="rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-cyan-300">
              ⚡ Paper Sim
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="rounded p-1 text-[#64748b] transition-colors hover:bg-[#112025] hover:text-[#c8d4d7]"
            title={isCollapsed ? "Expand panel" : "Minimize panel"}
          >
            {isCollapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          <div className="flex-1 min-h-0 overflow-auto p-3">
            {!hasAccess ? (
              <div className="flex h-full items-center justify-center">
                <div className="mx-auto max-w-sm rounded border border-[#1a2830] bg-[#0c181b] p-6 text-center shadow-lg">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#102830]">
                    <Plug className="h-6 w-6 text-[#22d3ee]" />
                  </div>
                  <h3 className="text-base font-semibold text-white">Wallet Required</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#64748b]">
                    Connect your Starknet wallet or launch an Instant Paper Wallet with $10,000 virtual USDC to view positions and trading history.
                  </p>
                  <button
                    onClick={() => setModalOpen(true)}
                    className="mt-4 inline-flex items-center gap-2 rounded bg-[#22d3ee] px-4 py-2 text-xs font-bold text-[#051518] transition-colors hover:bg-[#38e1fa]"
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
                    <div className="space-y-3 max-w-3xl">
                      <AccountRiskHUD />
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                        <div className="rounded border border-[#1a2830] bg-[#0c181b] p-2.5">
                          <div className="text-[10px] uppercase text-[#64748b]">Available Cash</div>
                          <div className="mt-0.5 text-sm font-bold font-mono text-white">
                            ${paperBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] text-[#22d3ee]">Virtual USDC</div>
                        </div>

                        <div className="rounded border border-[#1a2830] bg-[#0c181b] p-2.5">
                          <div className="text-[10px] uppercase text-[#64748b]">Used Margin</div>
                          <div className="mt-0.5 text-sm font-bold font-mono text-white">
                            ${paperMarginUsed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] text-[#64748b]">{paperPositions.length} active position(s)</div>
                        </div>

                        <div className="rounded border border-[#1a2830] bg-[#0c181b] p-2.5">
                          <div className="text-[10px] uppercase text-[#64748b]">Unrealized PnL</div>
                          <div className={cn(
                            "mt-0.5 text-sm font-bold font-mono",
                            paperPnl >= 0 ? "text-[#00d084]" : "text-[#ff4757]"
                          )}>
                            {paperPnl >= 0 ? "+" : ""}${paperPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] text-[#64748b]">Mark to Market</div>
                        </div>

                        <div className="rounded border border-[#1a2830] bg-[#0c181b] p-2.5">
                          <div className="text-[10px] uppercase text-[#64748b]">Total Equity</div>
                          <div className="mt-0.5 text-sm font-bold font-mono text-white">
                            ${paperEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] text-[#22d3ee]">Cash + Margin + PnL</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => {
                            faucet(10000);
                            toast.success("Added $10,000 virtual USDC");
                          }}
                          className="inline-flex items-center gap-1.5 rounded border border-[#1d4a50] bg-[#0e252a] px-3 py-1.5 text-xs font-semibold text-[#22d3ee] hover:bg-[#102c32]"
                        >
                          <PlusCircle className="h-3.5 w-3.5" />
                          Faucet (+$10,000 USDC)
                        </button>
                        <button
                          onClick={() => {
                            resetAccount();
                            toast.info("Paper account reset to $10,000 USDC");
                          }}
                          className="inline-flex items-center gap-1.5 rounded border border-[#1a2830] bg-[#0c181b] px-3 py-1.5 text-xs font-medium text-[#8ea4a9] hover:text-white hover:bg-[#121f24]"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Reset to $10,000
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 max-w-3xl">
                      <AccountRiskHUD />
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                        <div className="rounded border border-[#1a2830] bg-[#0c181b] p-2.5">
                          <div className="text-[10px] uppercase text-[#64748b]">STRK Token Balance</div>
                          <div className="mt-0.5 text-sm font-bold font-mono text-white">
                            {strkBalance !== null ? `${Number(strkBalance).toFixed(4)} STRK` : "Checking..."}
                          </div>
                          <div className="text-[10px] text-[#22d3ee]">Starknet Wallet</div>
                        </div>

                        <div className="rounded border border-[#1a2830] bg-[#0c181b] p-2.5">
                          <div className="text-[10px] uppercase text-[#64748b]">Available Margin</div>
                          <div className="mt-0.5 text-sm font-bold font-mono text-white">
                            ${realAvailable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] text-[#64748b]">USDC Margin</div>
                        </div>

                        <div className="rounded border border-[#1a2830] bg-[#0c181b] p-2.5">
                          <div className="text-[10px] uppercase text-[#64748b]">Margin Used</div>
                          <div className="mt-0.5 text-sm font-bold font-mono text-white">
                            ${realMarginUsed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] text-[#64748b]">Active Positions</div>
                        </div>

                        <div className="rounded border border-[#1a2830] bg-[#0c181b] p-2.5">
                          <div className="text-[10px] uppercase text-[#64748b]">Unrealized PnL</div>
                          <div className={cn(
                            "mt-0.5 text-sm font-bold font-mono",
                            realPnl >= 0 ? "text-[#00d084]" : "text-[#ff4757]"
                          )}>
                            {realPnl >= 0 ? "+" : ""}${realPnl.toFixed(2)}
                          </div>
                          <div className="text-[10px] text-[#64748b]">Live Positions</div>
                        </div>
                      </div>

                      {walletAddress && (
                        <div className="flex items-center justify-between rounded border border-[#1a2830] bg-[#0c181b] px-3.5 py-2 text-xs">
                          <div className="flex items-center gap-2 text-[#8ea4a9]">
                            <span>Connected Account:</span>
                            <span className="font-mono text-white">{walletAddress.slice(0, 10)}...{walletAddress.slice(-8)}</span>
                          </div>
                          <a
                            href={`https://voyager.online/contract/${walletAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-[#22d3ee] hover:underline"
                          >
                            Voyager Explorer <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  )
                )}
                {activeTab === "positions" && <OpenPositionsTable />}
                {activeTab === "orders" && <OpenOrdersTable />}
                {activeTab === "twap" && <TWAPOrdersTable />}
                {activeTab === "trades" && <TradeHistoryTable />}
                {activeTab === "funding" && <FundingHistoryTable />}
                {activeTab === "history" && <OrderHistoryTable />}
              </>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-[#1a2830] bg-[#081214] px-4 py-1.5">
            {hasAccess ? (
              <>
                <div className="flex items-center gap-6 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[#64748b]">Cross Margin</span>
                    <span className="font-mono text-white">
                      {isPaperTrading ? `$${paperMarginUsed.toFixed(2)}` : `$${realMarginUsed.toFixed(2)}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#64748b]">Available</span>
                    <span className="font-mono text-white">
                      {isPaperTrading ? `$${paperBalance.toFixed(2)}` : `$${realAvailable.toFixed(2)}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#64748b]">P&L</span>
                    <span className={cn(
                      "font-mono font-medium",
                      (isPaperTrading ? paperPnl : realPnl) >= 0 ? "text-[#00d084]" : "text-[#ff4757]"
                    )}>
                      {isPaperTrading
                        ? `${paperPnl >= 0 ? "+" : ""}$${paperPnl.toFixed(2)}`
                        : `${realPnl >= 0 ? "+" : ""}$${realPnl.toFixed(2)}`}
                    </span>
                  </div>
                  <div className="hidden lg:flex items-center pl-2 border-l border-[#1a2830]">
                    <AccountRiskHUD variant="compact" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCancelAll}
                    className="rounded border border-[#1a2830] bg-[#0c181b] px-2.5 py-1 text-xs text-[#64748b] hover:border-[#2a3a44] hover:text-white transition-colors"
                  >
                    Cancel All
                  </button>
                  <button
                    onClick={handleCloseAll}
                    className="rounded border border-[#1a2830] bg-[#0c181b] px-2.5 py-1 text-xs text-[#64748b] hover:border-[#2a3a44] hover:text-white transition-colors"
                  >
                    Close All
                  </button>
                </div>
              </>
            ) : (
              <div className="flex w-full items-center justify-between gap-3">
                <div className="text-xs text-[#64748b]">Wallet not connected</div>
                <ConnectWalletButton />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
