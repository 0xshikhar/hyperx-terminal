import { Flame, TrendingUp } from "lucide-react";

const leaderboard = [
  { rank: 1, trader: "0xA9...2F4", pnl: 42112.4, winRate: 82, trades: 184 },
  { rank: 2, trader: "0xB1...9A0", pnl: 32190.1, winRate: 79, trades: 141 },
  { rank: 3, trader: "0xC3...8D9", pnl: 28840.6, winRate: 77, trades: 138 },
  { rank: 4, trader: "0xD4...1B6", pnl: 22590.2, winRate: 74, trades: 121 },
  { rank: 5, trader: "0xE5...77A", pnl: 19812.8, winRate: 71, trades: 109 },
];

export function LeaderboardPage() {
  return (
    <div className="flex min-h-0 flex-col gap-4 px-4 py-4 md:px-5 lg:px-6">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr),minmax(300px,0.6fr)]">
        <div className="rounded-[18px] border border-[#213136] bg-[#091416] px-5 py-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-[#708084]">Leaderboard</p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <h1 className="text-3xl font-semibold tracking-tight text-white">Top Traders</h1>
            <span className="rounded-md border border-[#2a555c] bg-[#102125] px-2 py-1 text-xs font-medium text-[#53d8c8]">
              30d PnL
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-[#7e8c91]">
            The ranking view uses the same terminal surfaces so it feels like a native part of the product rather than a separate dashboard.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <MetricCard label="Leaders" value="5" helper="Visible ranks" />
          <MetricCard label="Avg Win Rate" value="76%" helper="Across top traders" />
          <MetricCard label="Best PnL" value="$42.1K" helper="Current leader" tone="positive" />
        </div>
      </section>

      <section className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr),320px]">
        <div className="rounded-[18px] border border-[#213136] bg-[#091416]">
          <div className="flex items-center justify-between border-b border-[#152327] px-4 py-3">
            <h2 className="text-sm font-semibold text-[#dde5e7]">Rankings</h2>
            <div className="flex items-center gap-2 text-xs text-[#7e8c91]">
              <Flame className="h-4 w-4 text-[#53d8c8]" />
              Live feed snapshot
            </div>
          </div>
          <div className="divide-y divide-[#152327]">
            {leaderboard.map((row) => (
              <div
                key={row.trader}
                className="grid grid-cols-[80px_minmax(0,1fr)_120px_100px] items-center gap-3 px-4 py-4 text-sm"
              >
                <div className="font-mono text-[#53d8c8]">#{row.rank}</div>
                <div>
                  <div className="font-mono text-[#dde5e7]">{row.trader}</div>
                  <div className="text-xs text-[#7e8c91]">{row.trades} trades</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-[#708084]">30d PnL</div>
                  <div className="font-mono text-[#53d8c8]">${row.pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-[#708084]">Win Rate</div>
                  <div className="font-mono text-white">{row.winRate}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <SidePanel
            title="Performance Shape"
            value="+28%"
            helper="Top traders are measured by risk-adjusted return, not raw size."
          />
          <SidePanel
            title="Execution Style"
            value="Fast"
            helper="High-frequency style traders cluster around short holding periods."
          />
          <div className="rounded-[18px] border border-[#213136] bg-[#091416] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#dde5e7]">
              <TrendingUp className="h-4 w-4 text-[#53d8c8]" />
              Readout
            </div>
            <div className="mt-3 space-y-2 text-sm text-[#7e8c91]">
              <p>• Compact surface keeps the ranking readable at a glance.</p>
              <p>• Sorting and rendering stay cheap to preserve responsiveness.</p>
              <p>• The visual hierarchy matches the terminal and markets pages.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
  tone = "neutral",
}: {
  label: string;
  value: string;
  helper: string;
  tone?: "neutral" | "positive";
}) {
  return (
    <div className="rounded-[18px] border border-[#213136] bg-[#091416] p-4">
      <p className="text-[10px] uppercase tracking-[0.12em] text-[#708084]">{label}</p>
      <p className={tone === "positive" ? "mt-2 font-mono text-2xl text-[#53d8c8]" : "mt-2 font-mono text-2xl text-white"}>
        {value}
      </p>
      <p className="mt-1 text-sm text-[#7e8c91]">{helper}</p>
    </div>
  );
}

function SidePanel({
  title,
  value,
  helper,
}: {
  title: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-[18px] border border-[#213136] bg-[#091416] p-4">
      <p className="text-[10px] uppercase tracking-[0.12em] text-[#708084]">{title}</p>
      <p className="mt-2 font-mono text-2xl text-white">{value}</p>
      <p className="mt-1 text-sm text-[#7e8c91]">{helper}</p>
    </div>
  );
}
