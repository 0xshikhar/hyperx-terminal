import { useNetworkStore } from "@/store/networkStore";
import type { ParadexNetwork } from "@hyperx/types/common";
import { cn } from "@/lib/utils";

const networks: { value: ParadexNetwork; label: string; color: string }[] = [
  { value: "testnet", label: "TESTNET", color: "text-amber-400" },
  { value: "mainnet", label: "MAINNET", color: "text-emerald-400" },
];

export function NetworkToggle() {
  const network = useNetworkStore((s) => s.network);
  const setNetwork = useNetworkStore((s) => s.setNetwork);

  return (
    <div className="hidden md:flex items-center gap-0.5 rounded-md border border-border/50 bg-secondary/30 p-0.5">
      {networks.map((n) => (
        <button
          key={n.value}
          onClick={() => setNetwork(n.value)}
          className={cn(
            "rounded px-2 py-1 font-mono text-[10px] tracking-wider uppercase transition-all duration-150",
            network === n.value
              ? "bg-primary/20 text-primary border border-primary/30"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50 border border-transparent"
          )}
        >
          <span className={cn("inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle", {
            "bg-emerald-400": n.value === "mainnet",
            "bg-amber-400": n.value === "testnet",
          })} />
          {n.label}
        </button>
      ))}
    </div>
  );
}
