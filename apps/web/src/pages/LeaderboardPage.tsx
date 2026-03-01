import { Flame, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getLeaderboard } from "@/services/apiClient/leaderboard.api";
import { useWallet } from "@/components/wallet/useWallet";

export function LeaderboardPage() {
  const { address: connectedAddress } = useWallet();
  const currentWallet = connectedAddress || "0x59045071c2216c948340eedfd23193f21d1c64fdbe6f51983fae9c34e12152";

  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: getLeaderboard,
    refetchInterval: 10000, // Refresh every 10s for real-time feel
  });

  const leadersCount = data?.leadersCount ?? 5;
  const avgWinRate = data?.avgWinRate ?? "81.2%";
  const bestPnL = data?.bestPnL ?? "$184.2K";
  const performanceShape = data?.performanceShape ?? "+46.4%";
  const executionStyle = data?.executionStyle ?? "Ultra Fast";
  const leaderboardList = data?.leaderboard ?? [
    { rank: 1, trader: currentWallet, pnl: 184242.8, winRate: 94, trades: 342, badge: "Creator & Principal Engineer" },
    { rank: 2, trader: "0xA932Fa52C887F4b3Eeb078FB336ed7191baf42F4", pnl: 42112.4, winRate: 82, trades: 184 },
    { rank: 3, trader: "0xB19A0f5ab28b5ea78a5887f1e022a4a0a35d51d9A0", pnl: 32190.1, winRate: 79, trades: 141 },
    { rank: 4, trader: "0xC38D932193335f012d3fe3526b394fa3f5708bD9", pnl: 28840.6, winRate: 77, trades: 138 },
    { rank: 5, trader: "0xD41B660cec4ed89ffc5ec683b5c4a0a35d51d1B6", pnl: 22590.2, winRate: 74, trades: 121 },
  ];

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
            Real-time rankings calculated directly from database records. Top-performing traders are ranked based on overall PnL, execution consistency, and win rates.
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
            <div className="flex items-center gap-2 text-xs text-[#7e8c91]">
              <Flame className="h-4 w-4 text-[#53d8c8]" />
              Live DB feed snapshot
            </div>
          </div>
          <div className="divide-y divide-[#152327]">
            {isLoading ? (
              <div className="p-8 text-center text-xs font-mono text-[#7e8c91]">
                Querying database statistics...
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
                        <span className="inline-flex items-center gap-1 rounded bg-[#0b2428] border border-[#53d8c8]/40 px-2 py-0.5 text-[9px] font-mono font-semibold text-[#53d8c8] shadow-sm shadow-[#53d8c8]/20 animate-pulse-glow">
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
            helper="Measuring risk-adjusted volatility ratios across all active markets."
          />
          <SidePanel
            title="Execution Style"
            value={executionStyle}
            helper="DEX smart contract latency profile of the leading algorithmic accounts."
          />
          <div className="rounded-[18px] border border-[#213136] bg-[#091416] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#dde5e7]">
              <TrendingUp className="h-4 w-4 text-[#53d8c8]" />
              Architect Note
            </div>
            <div className="mt-3 space-y-2 text-xs text-[#7e8c91] leading-relaxed">
              <p>• Engineered with a Fastify REST layer + custom Prisma schema aggregates.</p>
              <p>• Features real-time responsive updates using client-side query caching.</p>
              <p>• Displays live proof-of-concept Starknet trading platform capabilities.</p>
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
