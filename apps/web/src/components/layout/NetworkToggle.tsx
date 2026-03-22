import { useNetworkStore, type TradingMode } from "@/store/networkStore";
import { cn } from "@/lib/utils";

const modes: { value: TradingMode; label: string; dotClass: string }[] = [
  { value: "paper", label: "⚡ PAPER", dotClass: "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]" },
  { value: "testnet", label: "TESTNET", dotClass: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" },
  { value: "mainnet", label: "MAINNET", dotClass: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" },
];

export function NetworkToggle() {
  const tradingMode = useNetworkStore((s) => s.tradingMode);
  const setTradingMode = useNetworkStore((s) => s.setTradingMode);

  return (
    <div className="hidden md:flex items-center gap-1 rounded-lg border border-[#213136] bg-[#0c181b]/80 p-1 backdrop-blur-md">
      {modes.map((m) => (
        <button
          key={m.value}
          onClick={() => setTradingMode(m.value)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[11px] font-medium tracking-wider uppercase transition-all duration-150",
            tradingMode === m.value
              ? m.value === "paper"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                : m.value === "testnet"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                  : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
              : "text-[#7f8c90] hover:text-[#d4dbdd] hover:bg-[#152327] border border-transparent"
          )}
        >
          <span className={cn("inline-block h-1.5 w-1.5 rounded-full", m.dotClass)} />
          {m.label}
        </button>
      ))}
    </div>
  );
}
