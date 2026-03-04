import { useMemo, useState } from "react";
import type { AlertCondition } from "@/services/apiClient/alerts.api";
import { useMarketStore } from "@/store/marketStore";

type AlertFormProps = {
  onSubmit: (input: {
    market: string;
    condition: AlertCondition;
    targetPrice: string;
  }) => Promise<void>;
};

export function AlertForm({ onSubmit }: AlertFormProps) {
  const markets = useMarketStore((s) => s.markets);
  const [market, setMarket] = useState(markets[0]?.symbol ?? "BTC-USD");
  const [condition, setCondition] = useState<AlertCondition>("ABOVE");
  const [targetPrice, setTargetPrice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = useMemo(() => {
    return Boolean(market) && Boolean(targetPrice) && !isSubmitting;
  }, [isSubmitting, market, targetPrice]);

  const submit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      await onSubmit({ market, condition, targetPrice });
      setTargetPrice("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 rounded-md border border-border bg-card p-3">
      <div className="grid grid-cols-3 gap-2">
        <select
          value={market}
          onChange={(event) => setMarket(event.target.value)}
          className="rounded-md border border-border bg-background px-2 py-2 text-xs"
        >
          {markets.map((m) => (
            <option key={m.symbol} value={m.symbol}>
              {m.symbol}
            </option>
          ))}
        </select>
        <select
          value={condition}
          onChange={(event) => setCondition(event.target.value as AlertCondition)}
          className="rounded-md border border-border bg-background px-2 py-2 text-xs"
        >
          <option value="ABOVE">Above</option>
          <option value="BELOW">Below</option>
          <option value="PERCENT_CHANGE">% Change</option>
        </select>
        <input
          value={targetPrice}
          onChange={(event) => setTargetPrice(event.target.value)}
          placeholder="Target"
          className="rounded-md border border-border bg-background px-2 py-2 text-xs"
        />
      </div>

      <button
        onClick={submit}
        disabled={!canSubmit}
        className="w-full rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
      >
        {isSubmitting ? "Creating..." : "Create Alert"}
      </button>
    </div>
  );
}

