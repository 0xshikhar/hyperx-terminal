import { useMemo } from "react";
import { estimateLiquidationPrice } from "@/lib/liquidation";

type TradeFormInput = {
  market: string;
  side: "buy" | "sell";
  type: "market" | "limit" | "stop";
  size: string;
  price: string;
  stopPrice: string;
  takeProfit: string;
  stopLoss: string;
  leverage: number;
  lastPrice?: number;
  /** Venue constraints from market metadata — validation snaps to these when present. */
  constraints?: {
    tickSize?: number;
    sizeIncrement?: number;
    minOrderSize?: number;
    minNotional?: number;
    maxLeverage?: number;
    maintenanceMarginRate?: number;
  };
};

/** Epsilon-safe divisibility check for tick/increment snapping. */
function isMultipleOf(value: number, step: number): boolean {
  const quotient = value / step;
  return Math.abs(quotient - Math.round(quotient)) < 1e-6;
}

export type TradeFormErrors = Partial<
  Record<"size" | "price" | "stopPrice" | "takeProfit" | "stopLoss" | "leverage", string>
>;

/** Minimum order notional — mirrors Hyperliquid's $10 floor. */
const MIN_ORDER_NOTIONAL_USD = 10;
const MAX_LEVERAGE = 50;

export function useTradeForm(input: TradeFormInput) {
  const numericSize = useMemo(() => Number(input.size) || 0, [input.size]);
  const numericPrice = useMemo(() => Number(input.price) || 0, [input.price]);
  const numericStop = useMemo(
    () => Number(input.stopPrice) || 0,
    [input.stopPrice]
  );
  const numericTakeProfit = useMemo(
    () => Number(input.takeProfit) || 0,
    [input.takeProfit]
  );
  const numericStopLoss = useMemo(
    () => Number(input.stopLoss) || 0,
    [input.stopLoss]
  );

  const entryPrice = useMemo(() => {
    if (input.type === "market") return input.lastPrice ?? 0;
    if (input.type === "stop") return numericStop;
    return numericPrice;
  }, [input.type, input.lastPrice, numericPrice, numericStop]);

  const errors = useMemo<TradeFormErrors>(() => {
    const constraints = input.constraints;
    const next: TradeFormErrors = {};

    if (input.size && numericSize <= 0) {
      next.size = "Enter a valid size";
    }

    if (input.type === "limit" && numericPrice <= 0) {
      next.price = "Enter a valid limit price";
    } else if (
      input.type === "limit" &&
      constraints?.tickSize &&
      !isMultipleOf(numericPrice, constraints.tickSize)
    ) {
      next.price = `Price must be a multiple of ${constraints.tickSize}`;
    }

    if (input.type === "stop" && numericStop <= 0) {
      next.stopPrice = "Enter a valid stop price";
    }

    if (input.takeProfit && numericTakeProfit <= 0) {
      next.takeProfit = "Enter a valid take profit";
    } else if (numericTakeProfit > 0 && entryPrice > 0) {
      // TP must sit on the profit side of entry
      if (input.side === "buy" && numericTakeProfit <= entryPrice) {
        next.takeProfit = "Take profit must be above entry price";
      } else if (input.side === "sell" && numericTakeProfit >= entryPrice) {
        next.takeProfit = "Take profit must be below entry price";
      }
    }

    if (input.stopLoss && numericStopLoss <= 0) {
      next.stopLoss = "Enter a valid stop loss";
    } else if (numericStopLoss > 0 && entryPrice > 0) {
      // SL must sit on the loss side of entry
      if (input.side === "buy" && numericStopLoss >= entryPrice) {
        next.stopLoss = "Stop loss must be below entry price";
      } else if (input.side === "sell" && numericStopLoss <= entryPrice) {
        next.stopLoss = "Stop loss must be above entry price";
      }
    }

    const maxLeverage = constraints?.maxLeverage ?? MAX_LEVERAGE;
    if (input.leverage < 1 || input.leverage > maxLeverage) {
      next.leverage = `Leverage must be between 1 and ${maxLeverage}`;
    }

    // Venue minimum order value (Hyperliquid uses $10)
    const minNotional = constraints?.minNotional ?? MIN_ORDER_NOTIONAL_USD;
    const orderValue = numericSize * entryPrice;
    if (numericSize > 0 && entryPrice > 0 && orderValue < minNotional) {
      next.size = `Minimum order value is $${minNotional}`;
    }

    if (constraints?.minOrderSize && numericSize > 0 && numericSize < constraints.minOrderSize) {
      next.size = `Minimum size is ${constraints.minOrderSize}`;
    } else if (
      constraints?.sizeIncrement &&
      numericSize > 0 &&
      !isMultipleOf(numericSize, constraints.sizeIncrement)
    ) {
      next.size = `Size must be a multiple of ${constraints.sizeIncrement}`;
    }

    return next;
  }, [
    input.size,
    input.type,
    input.takeProfit,
    input.stopLoss,
    input.leverage,
    input.side,
    input.constraints,
    entryPrice,
    numericSize,
    numericPrice,
    numericStop,
    numericTakeProfit,
    numericStopLoss,
  ]);

  const isValid = useMemo(
    () => Boolean(input.size) && Object.keys(errors).length === 0,
    [errors, input.size]
  );

  const notional = useMemo(
    () => numericSize * entryPrice,
    [numericSize, entryPrice]
  );
  const margin = useMemo(
    () => (input.leverage > 0 ? notional / input.leverage : 0),
    [input.leverage, notional]
  );
  const liquidationEstimate = useMemo(
    () =>
      estimateLiquidationPrice(
        input.side,
        entryPrice,
        input.leverage,
        input.constraints?.maintenanceMarginRate
      ) ?? 0,
    [entryPrice, input.leverage, input.side, input.constraints]
  );

  return {
    errors,
    isValid,
    numericSize,
    entryPrice,
    notional,
    margin,
    liquidationEstimate,
  };
}
