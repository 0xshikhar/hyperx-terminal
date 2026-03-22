import {
  fromParadexMarketSymbol,
  normalizeMarketSymbol,
} from "@hyperx/types/common";

export function normalizeDexMarket<T extends object>(exchange: string, market: T) {
  const marketData = market as Record<string, unknown>;
  const explicitSymbol =
    (marketData.market as string | undefined) ??
    (marketData.symbol as string | undefined);
  const baseCurrency =
    (marketData.baseCurrency as string | undefined) ??
    (marketData.base_currency as string | undefined) ??
    "";
  const quoteCurrency =
    (marketData.quoteCurrency as string | undefined) ??
    (marketData.quote_currency as string | undefined) ??
    "";
  const rawSymbol =
    explicitSymbol ||
    (baseCurrency && quoteCurrency ? `${baseCurrency}-${quoteCurrency}` : baseCurrency);
  const canonicalSymbol =
    exchange.toLowerCase() === "paradex"
      ? fromParadexMarketSymbol(rawSymbol)
      : normalizeMarketSymbol(rawSymbol);

  return {
    ...marketData,
    symbol: canonicalSymbol,
    market: canonicalSymbol,
  };
}

export function pickValue<T extends Record<string, unknown>>(
  source: T,
  keys: string[]
): unknown {
  for (const key of keys) {
    if (key in source && source[key] != null) {
      return source[key];
    }
  }
  return undefined;
}

export function pickString<T extends Record<string, unknown>>(
  source: T,
  keys: string[],
  fallback = ""
): string {
  const value = pickValue(source, keys);
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

export function pickNumber<T extends Record<string, unknown>>(
  source: T,
  keys: string[],
  fallback = 0
): number {
  const value = pickValue(source, keys);
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export function toIsoTimestamp(value: unknown): string {
  if (typeof value === "number") {
    return new Date(value).toISOString();
  }
  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && value.trim() !== "") {
      return new Date(numeric).toISOString();
    }
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

export function mapParadexPosition(raw: Record<string, unknown>) {
  const marketRaw = pickString(raw, ["market", "symbol"]);
  const market = fromParadexMarketSymbol(marketRaw);
  const sideRaw = pickString(raw, ["side", "position_side"]);
  const side = sideRaw.toUpperCase() === "SHORT" ? "short" : "long";
  const sizeRaw = pickNumber(raw, ["size", "position_size", "positionSize"], 0);
  const size = Math.abs(sizeRaw);
  const entryPrice = pickNumber(raw, [
    "entry_price",
    "entryPrice",
    "average_entry_price",
    "avg_entry_price",
    "average_entry_price_usd",
  ]);
  const leverage = Math.max(
    pickNumber(raw, ["leverage", "position_leverage", "leverage_ratio"], 1),
    1
  );
  const margin =
    pickNumber(raw, ["margin", "initial_margin", "position_margin", "cost"], 0) ||
    (entryPrice && size ? (entryPrice * size) / leverage : 0);
  const unrealizedPnl = pickNumber(raw, [
    "unrealized_pnl",
    "unrealizedPnl",
    "pnl",
    "unrealized_pnl_usd",
  ]);
  let markPrice = pickNumber(raw, ["mark_price", "markPrice"], 0);
  if (!markPrice && entryPrice && size) {
    const direction = side === "long" ? 1 : -1;
    markPrice = entryPrice + (unrealizedPnl / size / direction);
  }
  if (!markPrice) markPrice = entryPrice || 0;

  const openedAt = toIsoTimestamp(
    pickValue(raw, ["created_at", "opened_at", "openedAt", "updated_at"])
  );
  const id = pickString(
    raw,
    ["id", "position_id", "positionId"],
    `${market}-${side}-${openedAt}`
  );
  const direction = side === "long" ? 1 : -1;
  const pnl = (markPrice - entryPrice) * size * direction;
  const pnlPercent = margin ? (pnl / margin) * 100 : 0;

  return {
    id,
    market,
    side,
    size,
    entryPrice,
    markPrice,
    leverage,
    margin,
    openedAt,
    pnl,
    pnlPercent,
  };
}

export function normalizeOrderStatus(statusRaw: string) {
  const status = statusRaw.toUpperCase();
  if (["OPEN", "NEW", "PENDING"].includes(status)) return "open";
  if (["PARTIAL", "PARTIALLY_FILLED"].includes(status)) return "partial";
  if (["FILLED", "CLOSED"].includes(status)) return "filled";
  if (["CANCELED", "CANCELLED", "REJECTED"].includes(status)) return "canceled";
  return "open";
}

export function mapParadexOrder(raw: Record<string, unknown>) {
  const marketRaw = pickString(raw, ["market", "symbol"]);
  const market = fromParadexMarketSymbol(marketRaw);
  const sideRaw = pickString(raw, ["side"]);
  const side = sideRaw.toUpperCase() === "SELL" ? "sell" : "buy";
  const typeRaw = pickString(raw, ["type"]);
  const typeUpper = typeRaw.toUpperCase();
  const type =
    typeUpper.startsWith("STOP") ? "stop" : typeUpper === "MARKET" ? "market" : "limit";
  const price = pickNumber(raw, ["price", "trigger_price", "triggerPrice"], 0);
  const size = pickNumber(raw, ["size", "remaining_size", "remainingSize"], 0);
  const status = normalizeOrderStatus(pickString(raw, ["status"], "OPEN"));
  const id = pickString(raw, ["id", "order_id", "orderId"], `${market}-${Date.now()}`);
  return { id, market, side, type, price, size, status };
}

export function mapParadexTrade(raw: Record<string, unknown>) {
  const marketRaw = pickString(raw, ["market", "symbol"]);
  const market = fromParadexMarketSymbol(marketRaw);
  const sideRaw = pickString(raw, ["side"]);
  const side = sideRaw.toUpperCase() === "SELL" ? "sell" : "buy";
  const size = pickNumber(raw, ["size", "quantity", "qty"], 0);
  const price = pickNumber(raw, ["price"], 0);
  const fee = pickNumber(raw, ["fee", "commission"], 0);
  const pnl = pickNumber(raw, ["pnl"], 0);
  const executedAt = toIsoTimestamp(
    pickValue(raw, ["timestamp", "time", "executed_at", "executedAt"])
  );
  const id = pickString(raw, ["id", "trade_id", "tradeId"], `${market}-${Date.now()}`);
  return { id, market, side, size, price, fee, pnl, executedAt };
}

export function mapParadexFunding(raw: Record<string, unknown>) {
  const marketRaw = pickString(raw, ["market", "symbol"]);
  const market = fromParadexMarketSymbol(marketRaw);
  const rate = pickNumber(raw, ["fundingRate", "funding_rate", "rate"], 0);
  const payment = pickNumber(raw, ["payment", "fundingPayment", "funding_payment"], 0);
  const time = toIsoTimestamp(pickValue(raw, ["time", "timestamp", "paid_at", "paidAt"]));
  const id = pickString(raw, ["id"], `${market}-${time}`);
  return { id, market, rate, payment, time };
}
