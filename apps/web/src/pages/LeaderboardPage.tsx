import { TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getLeaderboard } from "@/services/apiClient/leaderboard.api";

export function LeaderboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: getLeaderboard,
    refetchInterval: 10000,
  });

  const leaderboardList = data?.leaderboard ?? [];
  const leadersCount = data?.leadersCount ?? 0;
  const avgWinRate = data?.avgWinRate ?? "—";
  const bestPnL = data?.bestPnL ?? "—";
  const performanceShape = data?.performanceShape ?? "—";
  const executionStyle = data?.executionStyle ?? "—";

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
            Rankings will appear here once trade history is recorded per user. There is no demo feed.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <MetricCard label="Leaders" value={String(leadersCount)} helper="Ranked profiles" />
          <MetricCard label="Avg Win Rate" value={avgWinRate} helper="Top tier performance" />
          <MetricCard label="Best PnL" value={bestPnL} helper="Top active trader" tone="positive" />
        </div>
      </section>

      <section className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr),320px]">
        <div className="rounded-[18px] border border-[#213136] bg-[#091416]">
          <div className="flex items-center justify-between border-b border-[#152327] px-4 py-3">
            <h2 className="text-sm font-semibold text-[#dde5e7]">Rankings</h2>
          </div>
          <div className="divide-y divide-[#152327]">
            {isLoading ? (
              <div className="p-8 text-center text-xs font-mono text-[#7e8c91]">
                Loading leaderboard…
              </div>
            ) : leaderboardList.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#7e8c91]">
                No ranked traders yet.
              </div>
            ) : (
              leaderboardList.map((row) => (
                <div
                  key={row.trader}
                  className="grid grid-cols-[80px_minmax(0,1fr)_150px_100px] items-center gap-3 px-4 py-4 text-sm"
                >
                  <div className="font-mono text-[#53d8c8]">#{row.rank}</div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[#dde5e7]">
                        {row.trader.length > 20
                          ? `${row.trader.slice(0, 10)}...${row.trader.slice(-8)}`
                          : row.trader}
                      </span>
                      {row.badge && (
                        <span className="inline-flex items-center gap-1 rounded bg-[#0b2428] border border-[#53d8c8]/40 px-2 py-0.5 text-[9px] font-mono font-semibold text-[#53d8c8]">
                          {row.badge}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#7e8c91]">{row.trades} trades</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-[#708084]">30d PnL</div>
                    <div className="font-mono text-[#53d8c8]">
                      ${row.pnl.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-[#708084]">Win Rate</div>
                    <div className="font-mono text-white">{row.winRate}%</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <SidePanel
            title="Performance Shape"
            value={performanceShape}
            helper="Risk-adjusted volatility once live trade records exist."
          />
          <SidePanel
            title="Execution Style"
            value={executionStyle}
            helper="Filled from recorded trades, not a static demo string."
          />
          <div className="rounded-[18px] border border-[#213136] bg-[#091416] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#dde5e7]">
              <TrendingUp className="h-4 w-4 text-[#53d8c8]" />
              Status
            </div>
            <div className="mt-3 space-y-2 text-xs text-[#7e8c91] leading-relaxed">
              <p>Leaderboard data is empty until per-user Paradex sessions and trade records are wired.</p>
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
      <p className="mt-1 text-xs text-[#7e8c91]">{helper}</p>
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
      <p className="mt-1 text-xs text-[#7e8c91]">{helper}</p>
    </div>
  );
}
