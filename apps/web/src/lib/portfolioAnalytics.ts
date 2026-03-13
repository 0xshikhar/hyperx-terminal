import type { FundingHistoryDto, TradeHistoryDto } from "@/services/apiClient/positions.api";

export type PortfolioHistoryPosition = {
  market: string;
  side: "long" | "short";
  pnl: number;
  openedAt: string;
};

const HISTORY_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const toDayKey = (value: string | number | Date) =>
  new Date(value).toISOString().slice(0, 10);

const buildDayBuckets = () => {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);

  return Array.from({ length: HISTORY_DAYS }, (_, index) => {
    const date = new Date(end.getTime() - (HISTORY_DAYS - 1 - index) * DAY_MS);
    return {
      key: toDayKey(date),
      value: 0,
    };
  });
};

export function buildPortfolioPnlHistory(
  position: PortfolioHistoryPosition,
  trades: TradeHistoryDto[],
  funding: FundingHistoryDto[]
) {
  const buckets = buildDayBuckets();
  const openedAt = new Date(position.openedAt).getTime();

  const addDelta = (time: string, delta: number) => {
    const key = toDayKey(time);
    const bucket = buckets.find((entry) => entry.key === key);
    if (!bucket) return;
    if (new Date(time).getTime() < openedAt) return;
    bucket.value += delta;
  };

  for (const trade of trades) {
    if (trade.market !== position.market) continue;
    addDelta(trade.executedAt, trade.pnl - trade.fee);
  }

  for (const payment of funding) {
    if (payment.market !== position.market) continue;
    addDelta(payment.time, payment.payment);
  }

  const cumulative: number[] = [];
  let running = 0;
  for (const bucket of buckets) {
    running += bucket.value;
    cumulative.push(running);
  }

  const hasHistory = cumulative.some((value) => Math.abs(value) > 0.0001);
  if (!hasHistory) return [];

  const lastValue = cumulative[cumulative.length - 1] ?? 0;
  const offset = position.pnl - lastValue;

  return cumulative.map((value) => Number((value + offset).toFixed(4)));
}
