import { Wallet } from "lucide-react";
import { useWallet } from "@/components/wallet/useWallet";
import { WalletStatus } from "@/components/wallet/WalletStatus";

export function ConnectWalletButton() {
  const { isConnected, isConnecting, setModalOpen } = useWallet();

  if (isConnected) {
    return <WalletStatus />;
  }

  return (
    <button
      onClick={() => setModalOpen(true)}
      className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3.5 py-1.5 font-mono text-xs font-semibold text-primary transition-all duration-200 hover:bg-primary/20 hover:border-primary/50 shadow-sm"
      disabled={isConnecting}
    >
      <Wallet className="h-3.5 w-3.5" />
      {isConnecting ? "Connecting..." : "Connect Wallet"}
    </button>
  );
}
