import { useQuery } from "@tanstack/react-query";
import { useActiveMarket } from "@/store/marketStore";
import { useNetworkStore } from "@/store/networkStore";
import { useIsPaperTrading } from "@/hooks/useIsPaperTrading";
import { usePaperTradingStore } from "@/store/paperTradingStore";
import { useStarkzapBalance } from "@/hooks/useStarkzapBalance";
import { getAccountSummary } from "@/services/apiClient/account.api";
import { toast } from "sonner";
import { RotateCcw, PlusCircle } from "lucide-react";

export function AccountSummary() {
  const activeMarket = useActiveMarket();
  const network = useNetworkStore((s) => s.network);
  const isPaperTrading = useIsPaperTrading();

  const networkLabel = isPaperTrading
    ? "PAPER SIM"
    : network === "mainnet"
      ? "MAINNET"
      : "TESTNET";

  const networkColor = isPaperTrading
    ? "text-cyan-400 border-cyan-400/30 bg-cyan-400/10"
    : network === "mainnet"
      ? "text-emerald-400 border-emerald-400/30 bg-emerald-400/10"
      : "text-amber-400 border-amber-400/30 bg-amber-400/10";

  const strkBalance = useStarkzapBalance();

  const { data: realAccount, isLoading, isError } = useQuery({
    queryKey: ["account-summary"],
    queryFn: getAccountSummary,
    enabled: !isPaperTrading,
    staleTime: 15_000,
  });

  // Paper trading values
  const paperBalance = usePaperTradingStore((s) => s.balance);
  const paperPositions = usePaperTradingStore((s) => s.positions);
  const resetAccount = usePaperTradingStore((s) => s.resetAccount);
  const faucet = usePaperTradingStore((s) => s.faucet);

  const paperMarginUsed = paperPositions.reduce((acc, p) => acc + p.margin, 0);
  const paperUnrealizedPnl = paperPositions.reduce((acc, p) => acc + p.pnl, 0);
  const paperAvailable = paperBalance;

  const balance = isPaperTrading
    ? formatCurrency(paperBalance + paperMarginUsed, false, false)
    : formatCurrency(realAccount?.balance, isLoading, isError);

  const available = isPaperTrading
    ? formatCurrency(paperAvailable, false, false)
    : formatCurrency(realAccount?.available, isLoading, isError);

  const marginUsed = isPaperTrading
    ? formatCurrency(paperMarginUsed, false, false)
    : formatCurrency(realAccount?.marginUsed, isLoading, isError);

  const unrealizedPnlVal = isPaperTrading ? paperUnrealizedPnl : realAccount?.unrealizedPnl;
  const unrealizedPnl = isPaperTrading
    ? formatCurrency(unrealizedPnlVal, false, false, true)
    : formatCurrency(unrealizedPnlVal, isLoading, isError, true);

  return (
    <div className="rounded-[18px] border border-[#213136] bg-[#091416]">
      <div className="flex items-center justify-between border-b border-[#152327] px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[#dde5e7]">Account Summary</h3>
          <span className={`font-mono text-[10px] uppercase tracking-wider border rounded px-1.5 py-0.5 ${networkColor}`}>
            {networkLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isPaperTrading && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  faucet(10000);
                  toast.success("Added $10,000 virtual USDC");
                }}
                className="flex items-center gap-1 rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-300 hover:bg-cyan-500/20"
                title="Add $10,000 virtual funds"
              >
                <PlusCircle className="h-3 w-3" />
                +$10k
              </button>
              <button
                onClick={() => {
                  resetAccount();
                  toast.info("Paper account reset to $10,000");
                }}
                className="flex items-center gap-1 rounded border border-[#213136] bg-[#0c181b] px-2 py-0.5 text-[10px] text-[#708084] hover:text-white"
                title="Reset paper account"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            </div>
          )}
          <span className="text-xs text-[#7e8c91]">{activeMarket}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 p-4 text-xs text-[#7e8c91]">
        <AccountMetric label="Equity" value={balance} />
        <AccountMetric label="Available" value={available} />
        <AccountMetric label="Margin Used" value={marginUsed} />
        <AccountMetric
          label="Unrealized PnL"
          value={unrealizedPnl}
          tone={isPositiveValue(unrealizedPnl) ? "positive" : isNegativeValue(unrealizedPnl) ? "negative" : "neutral"}
        />
        <AccountMetric label={isPaperTrading ? "Virtual Asset" : "STRK Balance"} value={isPaperTrading ? "Simulated USDC" : (strkBalance ?? "--")} />
      </div>
    </div>
  );
}

function formatCurrency(
  value: number | undefined,
  isLoading: boolean,
  isError: boolean,
  forceSign = false
): string {
  if (isLoading) return "Loading...";
  if (isError || value === undefined) return "--";

  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Math.abs(value));

  if (forceSign) {
    return `${value >= 0 ? "+" : "-"}${amount}`;
  }

  return amount;
}

function isPositiveValue(value: string): boolean {
  return value.startsWith("+");
}

function isNegativeValue(value: string): boolean {
  return value.startsWith("-");
}

function AccountMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "negative";
}) {
  return (
    <div className="rounded-md border border-[#1d2b2f] bg-[#0c181b] px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.12em] text-[#708084]">{label}</p>
      <p
        className={
          tone === "positive"
            ? "mt-1 font-mono text-sm text-[#53d8c8]"
            : tone === "negative"
              ? "mt-1 font-mono text-sm text-[#ff8e8e]"
              : "mt-1 font-mono text-sm text-[#dde5e7]"
        }
      >
        {value}
      </p>
    </div>
  );
}
