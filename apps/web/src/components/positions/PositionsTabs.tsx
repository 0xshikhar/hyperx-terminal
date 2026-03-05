import { useState } from "react";
import { useMarketStore } from "@/store/marketStore";
import { cn } from "@/lib/utils";
import { Wallet, Plug, ArrowRight } from "lucide-react";
import { OpenPositionsTable } from "@/components/positions/OpenPositionsTable";
import { OpenOrdersTable } from "@/components/positions/OpenOrdersTable";
import { TradeHistoryTable } from "@/components/positions/TradeHistoryTable";
import { FundingHistoryTable } from "@/components/positions/FundingHistoryTable";
import { useWallet } from "@/components/wallet/useWallet";
import { WalletConnectDialog } from "@/components/wallet/WalletConnectDialog";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";

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
  const [walletPromptOpen, setWalletPromptOpen] = useState(false);
  const { connectWallet, isConnecting } = useWallet();

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
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00d084]" />
            )}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-4 px-4">
          <span className="text-xs text-[#6b6b74]">{activeMarket}</span>
          <button className="text-xs text-[#6b6b74] hover:text-[#d5dcde]">Filter</button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-4">
        {!isWalletConnected ? (
          <div className="flex h-full items-center justify-center">
            <div className="mx-auto max-w-sm rounded-lg border border-[#2a2a2e] bg-[#111315] p-8 text-center shadow-lg">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#1a3a3a]">
                <Plug className="h-7 w-7 text-[#53d8c8]" />
              </div>
              <h3 className="text-lg font-semibold text-white">Wallet Required</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#8a9294]">
                Connect your Starknet wallet to view your balances, positions, orders, and trading history.
              </p>
              <button
                onClick={connectWallet}
                disabled={isConnecting}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#53d8c8] px-6 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[#45c0b0] disabled:opacity-50"
              >
                <Wallet className="h-4 w-4" />
                {isConnecting ? "Connecting..." : "Connect Wallet"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <>
            {activeTab === "balances" && (
              <EmptyState message="No spot balances available yet" />
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
        {isWalletConnected ? (
          <>
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
          </>
        ) : (
          <div className="flex w-full items-center justify-between gap-3">
            <div className="text-xs text-[#6b6b74]">Wallet not connected</div>
            <ConnectWalletButton />
          </div>
        )}
      </div>

      <WalletConnectDialog
        open={walletPromptOpen}
        onOpenChange={setWalletPromptOpen}
        title="Connect to manage positions"
        description="Cancelling orders or closing positions requires a connected Starknet wallet."
      />
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
