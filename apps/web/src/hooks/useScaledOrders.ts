import { useMemo } from "react";

export type ScaledDistribution = "flat" | "pyramid" | "inverted";

export interface ScaledOrderRung {
  index: number;
  price: number;
  size: number;
  notional: number;
  weightPercent: number;
}

export interface UseScaledOrdersParams {
  startPrice: number;
  endPrice: number;
  totalSize: number;
  orderCount: number;
  distribution: ScaledDistribution;
  leverage?: number;
}

export interface ScaledOrdersResult {
  orders: ScaledOrderRung[];
  averagePrice: number;
  totalNotional: number;
  requiredMargin: number;
  isValid: boolean;
  validationError: string | null;
}

export function calculateScaledOrders({
  startPrice,
  endPrice,
  totalSize,
  orderCount,
  distribution,
  leverage = 10,
}: UseScaledOrdersParams): ScaledOrdersResult {
  const count = Math.min(10, Math.max(3, Math.round(orderCount) || 5));

  if (startPrice <= 0 || endPrice <= 0) {
    return {
      orders: [],
      averagePrice: 0,
      totalNotional: 0,
      requiredMargin: 0,
      isValid: false,
      validationError: "Enter valid start and end prices",
    };
  }

  if (startPrice === endPrice) {
    return {
      orders: [],
      averagePrice: 0,
      totalNotional: 0,
      requiredMargin: 0,
      isValid: false,
      validationError: "Start and end prices cannot be equal",
    };
  }

  if (totalSize <= 0) {
    return {
      orders: [],
      averagePrice: 0,
      totalNotional: 0,
      requiredMargin: 0,
      isValid: false,
      validationError: "Enter a valid total size greater than 0",
    };
  }

  // Calculate weights according to distribution
  const weights: number[] = [];
  for (let i = 0; i < count; i++) {
    if (distribution === "flat") {
      weights.push(1);
    } else if (distribution === "pyramid") {
      // Increasing: heavier allocations deeper into the range
      weights.push(1 + i * 0.5);
    } else {
      // Inverted: heavier allocations closer to start price
      weights.push(1 + (count - 1 - i) * 0.5);
    }
  }

  const totalWeight = weights.reduce((acc, w) => acc + w, 0);
  const priceStep = (endPrice - startPrice) / (count - 1);

  let totalNotional = 0;
  const orders: ScaledOrderRung[] = [];

  for (let i = 0; i < count; i++) {
    const rungPrice = Number((startPrice + i * priceStep).toFixed(2));
    const rungWeight = weights[i] / totalWeight;
    const rungSize = Number((totalSize * rungWeight).toFixed(4));
    const rungNotional = rungPrice * rungSize;

    totalNotional += rungNotional;

    orders.push({
      index: i + 1,
      price: rungPrice,
      size: rungSize,
      notional: rungNotional,
      weightPercent: rungWeight * 100,
    });
  }

  const averagePrice = totalSize > 0 ? totalNotional / totalSize : 0;
  const safeLev = Math.max(1, leverage);
  const requiredMargin = totalNotional / safeLev;

  return {
    orders,
    averagePrice,
    totalNotional,
    requiredMargin,
    isValid: true,
    validationError: null,
  };
}

export function useScaledOrders(params: UseScaledOrdersParams): ScaledOrdersResult {
  return useMemo(() => calculateScaledOrders(params), [
    params.startPrice,
    params.endPrice,
    params.totalSize,
    params.orderCount,
    params.distribution,
    params.leverage,
  ]);
}
