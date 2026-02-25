const leaderboard = [
  { rank: 1, trader: "0xA9...2F4", pnl: 42112.4 },
  { rank: 2, trader: "0xB1...9A0", pnl: 32190.1 },
  { rank: 3, trader: "0xC3...8D9", pnl: 28840.6 },
];

export function LeaderboardPage() {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Leaderboard</h1>
      <div className="rounded-lg border border-border bg-card p-4 text-sm">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Trader</span>
          <span>30d PnL</span>
        </div>
        <div className="mt-3 space-y-2">
          {leaderboard.map((row) => (
            <div
              key={row.trader}
              className="flex items-center justify-between rounded-md border border-border px-3 py-2"
            >
              <span className="font-mono">#{row.rank} {row.trader}</span>
              <span className="font-mono text-emerald-500">
                ${row.pnl.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
