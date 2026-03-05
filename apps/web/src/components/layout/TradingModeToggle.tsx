import { useTradingModeStore, type TradingMode } from "@/store/tradingModeStore";
import { cn } from "@/lib/utils";

const modes: { value: TradingMode; label: string; color: string }[] = [
  { value: "real", label: "REAL", color: "text-emerald-400" },
  { value: "paper", label: "PAPER", color: "text-amber-400" },
  { value: "demo", label: "DEMO", color: "text-rose-400" },
];

export function TradingModeToggle() {
  const mode = useTradingModeStore((s) => s.mode);
  const setMode = useTradingModeStore((s) => s.setMode);

  return (
    <div className="hidden md:flex items-center gap-0.5 rounded-md border border-border/50 bg-secondary/30 p-0.5">
      {modes.map((m) => (
        <button
          key={m.value}
          onClick={() => setMode(m.value)}
          className={cn(
            "rounded px-2 py-1 font-mono text-[10px] tracking-wider uppercase transition-all duration-150",
            mode === m.value
              ? "bg-primary/20 text-primary border border-primary/30"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50 border border-transparent"
          )}
        >
          <span className={cn("inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle", {
            "bg-emerald-400": m.value === "real",
            "bg-amber-400": m.value === "paper",
            "bg-rose-400": m.value === "demo",
          })} />
          {m.label}
        </button>
      ))}
    </div>
  );
}
