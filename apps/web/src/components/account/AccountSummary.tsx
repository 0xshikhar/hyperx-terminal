import { useQuery } from "@tanstack/react-query";
import { useMarketStore } from "@/store/marketStore";
import { useNetworkStore } from "@/store/networkStore";
import { useStarkzapBalance } from "@/hooks/useStarkzapBalance";
import { getAccountSummary } from "@/services/apiClient/account.api";

export function AccountSummary() {
  const { activeMarket } = useMarketStore();
  const network = useNetworkStore((s) => s.network);
  const networkLabel = network === "mainnet" ? "MAINNET" : "TESTNET";
  const networkColor = network === "mainnet" ? "text-emerald-400 border-emerald-400/30" : "text-amber-400 border-amber-400/30";
  const strkBalance = useStarkzapBalance();
  const { data: account, isLoading, isError } = useQuery({
    queryKey: ["account-summary"],
    queryFn: getAccountSummary,
    staleTime: 15_000,
  });

  const balance = formatCurrency(account?.balance, isLoading, isError);
  const available = formatCurrency(account?.available, isLoading, isError);
  const marginUsed = formatCurrency(account?.marginUsed, isLoading, isError);
  const unrealizedPnl = formatCurrency(account?.unrealizedPnl, isLoading, isError, true);

  return (
    <div className="rounded-[18px] border border-[#213136] bg-[#091416]">
      <div className="flex items-center justify-between border-b border-[#152327] px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[#dde5e7]">Account Summary</h3>
          <span className={`font-mono text-[10px] uppercase tracking-wider border rounded px-1.5 py-0.5 ${networkColor}`}>
            {networkLabel}
          </span>
        </div>
        <span className="text-xs text-[#7e8c91]">{activeMarket}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 p-4 text-xs text-[#7e8c91]">
        <AccountMetric label="Balance" value={balance} />
        <AccountMetric label="Available" value={available} />
        <AccountMetric label="Margin Used" value={marginUsed} />
        <AccountMetric label="Unrealized PnL" value={unrealizedPnl} tone={isPositiveValue(unrealizedPnl) ? "positive" : "negative"} />
        <AccountMetric label="STRK Balance" value={strkBalance ?? "--"} />
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
