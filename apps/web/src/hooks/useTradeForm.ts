import { useMemo } from "react";

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
};

export type TradeFormErrors = Partial<
  Record<"size" | "price" | "stopPrice" | "takeProfit" | "stopLoss" | "leverage", string>
>;

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
    const next: TradeFormErrors = {};

    if (!input.size || numericSize <= 0) {
      next.size = "Enter a valid size";
    }

    if (input.type === "limit" && numericPrice <= 0) {
      next.price = "Enter a valid limit price";
    }

    if (input.type === "stop" && numericStop <= 0) {
      next.stopPrice = "Enter a valid stop price";
    }

    if (input.takeProfit && numericTakeProfit <= 0) {
      next.takeProfit = "Enter a valid take profit";
    }

    if (input.stopLoss && numericStopLoss <= 0) {
      next.stopLoss = "Enter a valid stop loss";
    }

    if (input.leverage < 1 || input.leverage > 50) {
      next.leverage = "Leverage must be between 1 and 50";
    }

    return next;
  }, [
    input.size,
    input.type,
    input.takeProfit,
    input.stopLoss,
    input.leverage,
    numericSize,
    numericPrice,
    numericStop,
    numericTakeProfit,
    numericStopLoss,
  ]);

  const isValid = useMemo(() => Object.keys(errors).length === 0, [errors]);

  const notional = useMemo(
    () => numericSize * entryPrice,
    [numericSize, entryPrice]
  );
  const margin = useMemo(
    () => (input.leverage > 0 ? notional / input.leverage : 0),
    [input.leverage, notional]
  );
  const liquidationEstimate = useMemo(() => {
    if (input.leverage <= 0) return 0;
    if (!entryPrice) return 0;
    return input.side === "buy"
      ? entryPrice * (1 - 1 / input.leverage)
      : entryPrice * (1 + 1 / input.leverage);
  }, [entryPrice, input.leverage, input.side]);

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
