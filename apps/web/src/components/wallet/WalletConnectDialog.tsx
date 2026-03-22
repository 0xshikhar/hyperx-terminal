import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useWallet } from "@/components/wallet/useWallet";
import { useNetworkStore } from "@/store/networkStore";
import { Zap, ShieldCheck, ArrowRight, Wallet, CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type WalletConnectDialogProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  description?: string;
};

export function WalletConnectDialog({
  open,
  onOpenChange,
  title = "Connect to HyperX Terminal",
  description = "Select how you would like to trade on HyperX. Start immediately with a simulated paper wallet or connect an on-chain Starknet wallet.",
}: WalletConnectDialogProps) {
  const { isModalOpen, setModalOpen, connectPaperWallet, connectWallet, isConnecting } = useWallet();
  const network = useNetworkStore((s) => s.network);
  const setNetwork = useNetworkStore((s) => s.setNetwork);
  const [selectedNetwork, setSelectedNetwork] = useState<"testnet" | "mainnet">(network);

  const isControlled = typeof open === "boolean";
  const isOpen = isControlled ? open : isModalOpen;
  const handleOpenChange = (val: boolean) => {
    if (isControlled && onOpenChange) {
      onOpenChange(val);
    } else {
      setModalOpen(val);
    }
  };

  const handleConnectPaper = () => {
    connectPaperWallet();
    handleOpenChange(false);
    toast.success("⚡ Connected to HyperX Paper Wallet ($10,000 virtual USDC)");
  };

  const handleConnectStarknet = async () => {
    try {
      setNetwork(selectedNetwork);
      await connectWallet();
      handleOpenChange(false);
      toast.success("Connected to Starknet wallet");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to connect Starknet wallet";
      if (!msg.includes("No Starknet wallet selected") && !msg.includes("user rejected") && !msg.includes("User rejected")) {
        toast.error(msg);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="border-[#213136] bg-[#0c181b] text-white sm:max-w-xl p-0 overflow-hidden shadow-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-[#1a282c] bg-[#081113]">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 border border-primary/30 text-primary">
              <Zap className="h-4 w-4" />
            </span>
            <DialogTitle className="text-lg font-bold tracking-tight text-white">
              {title}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-[#8a9ca0] pt-1 leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-4">
          {/* OPTION 1: INSTANT PAPER TRADING WALLET */}
          <div className="relative group rounded-xl border-2 border-cyan-500/40 bg-gradient-to-b from-[#0e252a] to-[#0a1b1f] p-5 shadow-lg transition-all hover:border-cyan-400">
            <div className="absolute -top-3 right-4 flex items-center gap-1 rounded-full bg-cyan-400 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black shadow-md">
              <Sparkles className="h-3 w-3" />
              Recommended Demo
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-400/20 text-cyan-300">
                    <Zap className="h-3.5 w-3.5" />
                  </span>
                  <h4 className="text-sm font-semibold text-white">Instant Paper Wallet</h4>
                </div>
                <p className="text-xs text-[#9ab4b9] leading-relaxed">
                  Start trading immediately with <strong className="text-cyan-300 font-semibold">$10,000 virtual USDC</strong>. Zero setup, no browser extensions needed.
                </p>

                <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] text-[#7d9b9f]">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-cyan-400 shrink-0" />
                    <span>$10,000 virtual balance</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-cyan-400 shrink-0" />
                    <span>Simulated order matching</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-cyan-400 shrink-0" />
                    <span>Live BTC/ETH/SOL prices</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-cyan-400 shrink-0" />
                    <span>Up to 50x leverage</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-cyan-500/20 flex items-center justify-end">
              <button
                onClick={handleConnectPaper}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-400 to-teal-400 px-5 py-2.5 text-xs font-bold text-black shadow-md transition-all hover:brightness-110 active:scale-98"
              >
                <span>Launch Paper Wallet</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* OPTION 2: STARKNET WEB3 WALLET */}
          <div className="rounded-xl border border-[#213136] bg-[#091518] p-5 transition-all hover:border-[#31454c]">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#16272b] text-[#8ea4a9]">
                    <Wallet className="h-3.5 w-3.5" />
                  </span>
                  <h4 className="text-sm font-semibold text-white">Starknet Web3 Wallet</h4>
                  <span className="text-[10px] text-[#6d8185] border border-[#213136] px-1.5 py-0.5 rounded">
                    Argent X • Braavos
                  </span>
                </div>
                <p className="text-xs text-[#8a9ca0] leading-relaxed">
                  Connect your browser wallet to execute authenticated on-chain orders.
                </p>

                {/* Network selector */}
                <div className="pt-2 flex items-center gap-2">
                  <span className="text-[11px] text-[#6f8286]">Network:</span>
                  <div className="inline-flex rounded-lg border border-[#1f2f34] bg-[#0c181b] p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setSelectedNetwork("testnet")}
                      className={cn(
                        "rounded px-2.5 py-1 text-[11px] font-mono transition-colors",
                        selectedNetwork === "testnet"
                          ? "bg-amber-400/20 text-amber-300 font-semibold"
                          : "text-[#738589] hover:text-white"
                      )}
                    >
                      Sepolia Testnet
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedNetwork("mainnet")}
                      className={cn(
                        "rounded px-2.5 py-1 text-[11px] font-mono transition-colors",
                        selectedNetwork === "mainnet"
                          ? "bg-emerald-400/20 text-emerald-300 font-semibold"
                          : "text-[#738589] hover:text-white"
                      )}
                    >
                      Mainnet
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#1a292d] flex items-center justify-end">
              <button
                onClick={handleConnectStarknet}
                disabled={isConnecting}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg border border-[#2d4148] bg-[#142327] px-5 py-2.5 text-xs font-semibold text-white transition-all hover:bg-[#1b2f34] hover:border-[#3e5963] disabled:opacity-50"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                <span>{isConnecting ? "Connecting..." : "Connect Starknet Wallet"}</span>
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}