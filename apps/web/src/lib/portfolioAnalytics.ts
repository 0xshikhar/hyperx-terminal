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

const buildFallbackSeries = (position: PortfolioHistoryPosition) => {
  const horizon = HISTORY_DAYS - 1;
  const sign = position.pnl >= 0 ? 1 : -1;
  const start = position.pnl - Math.max(Math.abs(position.pnl) * 0.7, 1) * sign;

  return Array.from({ length: HISTORY_DAYS }, (_, index) => {
    const ratio = horizon > 0 ? index / horizon : 1;
    return start + (position.pnl - start) * ratio;
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
  const baseSeries = hasHistory ? cumulative : buildFallbackSeries(position);
  const lastValue = baseSeries[baseSeries.length - 1] ?? 0;
  const offset = position.pnl - lastValue;

  return baseSeries.map((value) => Number((value + offset).toFixed(4)));
}
