import type { ReactNode } from "react";

type TerminalGridProps = {
  marketSelector: ReactNode;
  orderBook: ReactNode;
  tradeForm: ReactNode;
  chart: ReactNode;
  recentTrades: ReactNode;
  positions: ReactNode;
};

export function TerminalGrid({
  marketSelector,
  orderBook,
  tradeForm,
  chart,
  recentTrades,
  positions,
}: TerminalGridProps) {
  return (
    <div className="grid h-full grid-cols-1 gap-4 p-4 lg:grid-cols-12">
      <div className="lg:col-span-9">{marketSelector}</div>
      <div className="lg:col-span-3 lg:row-span-2">{orderBook}</div>
      <div className="lg:col-span-6 lg:row-span-2">{chart}</div>
      <div className="lg:col-span-3">{tradeForm}</div>
      <div className="lg:col-span-3">{recentTrades}</div>
      <div className="lg:col-span-9">{positions}</div>
    </div>
  );
}
