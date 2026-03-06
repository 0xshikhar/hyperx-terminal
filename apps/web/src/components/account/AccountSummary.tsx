import { useMarketStore } from "@/store/marketStore";
import { useStarkzapBalance } from "@/hooks/useStarkzapBalance";

export function AccountSummary() {
  const { activeMarket } = useMarketStore();
  const strkBalance = useStarkzapBalance();

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Account Summary</h3>
        <span className="text-xs text-muted-foreground">{activeMarket}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 text-xs text-muted-foreground">
        <div>
          <p className="text-[10px] uppercase">Balance</p>
          <p className="text-sm font-mono text-foreground">$52,430.12</p>
        </div>
        <div>
          <p className="text-[10px] uppercase">Available</p>
          <p className="text-sm font-mono text-foreground">$18,742.44</p>
        </div>
        <div>
          <p className="text-[10px] uppercase">Margin Used</p>
          <p className="text-sm font-mono text-foreground">$33,687.68</p>
        </div>
        <div>
          <p className="text-[10px] uppercase">Unrealized PnL</p>
          <p className="text-sm font-mono text-emerald-500">+$1,218.33</p>
        </div>
        <div>
          <p className="text-[10px] uppercase">STRK Balance</p>
          <p className="text-sm font-mono text-foreground">
            {strkBalance ?? "--"}
          </p>
        </div>
      </div>
    </div>
  );
}
