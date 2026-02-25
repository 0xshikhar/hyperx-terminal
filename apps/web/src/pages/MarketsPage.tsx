import { MarketScreener } from "@/components/market-selector/MarketScreener";

export function MarketsPage() {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Markets</h1>
      <MarketScreener />
    </div>
  );
}
