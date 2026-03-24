import { useState, useRef, useEffect } from "react";
import { Copy, LogOut, ChevronDown, PlusCircle, RotateCcw, ArrowRightLeft, Check } from "lucide-react";
import { useWallet } from "@/components/wallet/useWallet";
import { usePaperTradingStore } from "@/store/paperTradingStore";
import { useNetworkStore } from "@/store/networkStore";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type WalletStatusProps = {
  address?: string;
};

export function WalletStatus({ address: propAddress }: WalletStatusProps) {
  const { address: walletAddress, isPaperWallet, disconnectWallet, setModalOpen } = useWallet();
  const address = propAddress || walletAddress || "";
  const network = useNetworkStore((s) => s.network);

  const paperBalance = usePaperTradingStore((s) => s.balance);
  const faucet = usePaperTradingStore((s) => s.faucet);
  const resetAccount = usePaperTradingStore((s) => s.resetAccount);

  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success("Address copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDisconnect = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    await disconnectWallet();
    toast.info("Wallet disconnected");
  };

  const handleFaucet = (e: React.MouseEvent) => {
    e.stopPropagation();
    faucet(10000);
    toast.success("Added $10,000 virtual USDC");
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    resetAccount();
    toast.info("Virtual account reset to $10,000 USDC");
  };

  const handleSwitchWallet = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    setModalOpen(true);
  };

  const truncatedAddress = address.length > 12
    ? `${address.slice(0, 7)}...${address.slice(-4)}`
    : address;

  if (isPaperWallet) {
    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-mono transition-all hover:bg-cyan-500/20 hover:border-cyan-400 shadow-sm"
        >
          <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-bold text-cyan-300">⚡ PAPER</span>
          <span className="text-[#8ec5ce]">{truncatedAddress}</span>
          <span className="hidden sm:inline-block rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-200">
            ${paperBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
          <ChevronDown className={cn("h-3 w-3 text-cyan-400 transition-transform", isOpen && "rotate-180")} />
        </button>

        {isOpen && (
          <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-[#213136] bg-[#0c181b] p-2 shadow-2xl z-50 animate-in fade-in-0 duration-75">
            <div className="p-2 border-b border-[#18262a]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                  Paper Trading Wallet
                </span>
                <span className="text-[10px] text-[#71868b]">Simulated</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="font-mono text-white text-xs">{truncatedAddress}</span>
                <button
                  onClick={handleCopy}
                  className="p-1 text-[#71868b] hover:text-cyan-300 rounded"
                  title="Copy address"
                >
                  {copied ? <Check className="h-3 w-3 text-cyan-400" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
              <div className="mt-2 rounded-md bg-[#081215] p-2 border border-[#162529]">
                <div className="text-[10px] text-[#6d8287]">Virtual Balance</div>
                <div className="text-base font-bold font-mono text-white">
                  ${paperBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-normal text-[#6d8287]">USDC</span>
                </div>
              </div>
            </div>

            <div className="py-1 space-y-0.5 text-xs">
              <button
                onClick={handleFaucet}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[#9cb4b9] hover:text-white hover:bg-[#152327] transition-colors"
              >
                <PlusCircle className="h-3.5 w-3.5 text-cyan-400" />
                <span>Add $10,000 Virtual Funds</span>
              </button>
              <button
                onClick={handleReset}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[#9cb4b9] hover:text-white hover:bg-[#152327] transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5 text-amber-400" />
                <span>Reset Virtual Balance</span>
              </button>
              <button
                onClick={handleSwitchWallet}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[#9cb4b9] hover:text-white hover:bg-[#152327] transition-colors"
              >
                <ArrowRightLeft className="h-3.5 w-3.5 text-emerald-400" />
                <span>Switch to Web3 Wallet</span>
              </button>
            </div>

            <div className="pt-1 border-t border-[#18262a]">
              <button
                onClick={handleDisconnect}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors text-xs"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Disconnect</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Starknet on-chain wallet status
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-mono">
      <span className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
        network === "mainnet" ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"
      )}>
        {network}
      </span>
      <span className="max-w-[110px] truncate text-foreground">{truncatedAddress}</span>
      <button
        onClick={handleCopy}
        className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
        title="Copy address"
      >
        {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
      </button>
      <button
        onClick={handleDisconnect}
        className="rounded p-1 text-muted-foreground hover:text-rose-400 transition-colors"
        title="Disconnect wallet"
      >
        <LogOut className="h-3 w-3" />
      </button>
    </div>
  );
}
