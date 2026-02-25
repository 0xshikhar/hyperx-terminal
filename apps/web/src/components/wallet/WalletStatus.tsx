import { Copy, LogOut } from "lucide-react";
import { useWallet } from "@/components/wallet/useWallet";
import { cn } from "@/lib/utils";

type WalletStatusProps = {
  address: string;
};

export function WalletStatus({ address }: WalletStatusProps) {
  const { disconnectWallet } = useWallet();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(address);
  };

  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1 text-xs">
      <span className="max-w-[120px] truncate font-mono">{address}</span>
      <button
        onClick={handleCopy}
        className={cn(
          "rounded-sm p-1 text-muted-foreground hover:text-foreground"
        )}
      >
        <Copy className="h-3 w-3" />
      </button>
      <button
        onClick={disconnectWallet}
        className={cn(
          "rounded-sm p-1 text-muted-foreground hover:text-foreground"
        )}
      >
        <LogOut className="h-3 w-3" />
      </button>
    </div>
  );
}
