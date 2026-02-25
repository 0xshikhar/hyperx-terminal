import { Wallet } from "lucide-react";
import { useWallet } from "@/components/wallet/useWallet";
import { WalletStatus } from "@/components/wallet/WalletStatus";

export function ConnectWalletButton() {
  const { address, isConnected, isConnecting, connectWallet } = useWallet();

  if (isConnected && address) {
    return <WalletStatus address={address} />;
  }

  return (
    <button
      onClick={connectWallet}
      className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm"
      disabled={isConnecting}
    >
      <Wallet className="h-4 w-4" />
      {isConnecting ? "Connecting..." : "Connect Wallet"}
    </button>
  );
}
