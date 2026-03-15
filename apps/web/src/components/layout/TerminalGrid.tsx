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
    <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[280px,minmax(0,1fr),360px] xl:grid-rows-[minmax(420px,1fr),minmax(300px,0.86fr)]">
      <section
        className="min-h-0 outline-none xl:row-span-2"
        data-vim-nav="true"
        tabIndex={0}
      >
        {marketSelector}
      </section>

      <section className="min-h-0 outline-none" data-vim-nav="true" tabIndex={0}>
        {chart}
      </section>

      <section className="min-h-0 outline-none" data-vim-nav="true" tabIndex={0}>
        {tradeForm}
      </section>

      <section className="min-h-0 outline-none" data-vim-nav="true" tabIndex={0}>
        {positions}
      </section>

      <section className="grid min-h-0 gap-4 xl:grid-rows-[minmax(0,1fr),minmax(0,0.78fr)]">
        <div className="min-h-0 outline-none" data-vim-nav="true" tabIndex={0}>
          {orderBook}
        </div>
        <div className="min-h-0 outline-none" data-vim-nav="true" tabIndex={0}>
          {recentTrades}
        </div>
      </section>
    </div>
  );
}
