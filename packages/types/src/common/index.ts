/**
 * Common enums and base types used across the HyperX Terminal
 */

// Order related enums
export type OrderSide = "buy" | "sell";
export type OrderType = "limit" | "market" | "stop" | "stop_limit";
export type OrderStatus = "open" | "partial" | "filled" | "canceled" | "pending";
export type PositionSide = "long" | "short";
export type TradeSide = "buy" | "sell";

// Alert and notification enums
export type AlertCondition = "ABOVE" | "BELOW" | "PERCENT_CHANGE";
export type NotificationStatus = "unread" | "read";
export type NotificationType = "price_alert" | "order_filled" | "liquidation" | "system";

// Market symbol helpers
export * from "./market.js";

// Market and exchange enums
export type TradeExchange = "EXTENDED" | "PARADEX" | "STARKZAP";
export type MarketStatus = "active" | "paused" | "closed";
export type CandleInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d" | "1w";

// DEX related
export type SupportedNetwork = "mainnet" | "sepolia";
export type DEXOrderStatus = "pending" | "open" | "filled" | "partial" | "canceled" | "failed";

// Pagination
export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
    nextCursor?: string;
  };
}

// Time range
export interface TimeRange {
  start?: Date | string;
  end?: Date | string;
}

// API Response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// Metric types
export interface MetricPayload {
  name: string;
  value: number;
  timestamp: number;
  meta?: Record<string, unknown>;
}

export interface LatencyMetrics {
  apiLatency: number;
  wsLatency: number;
  timestamp: number;
}
