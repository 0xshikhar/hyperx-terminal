/**
 * API DTO types for REST endpoints
 */

import type {
  AlertCondition,
  CandleInterval,
  NotificationStatus,
  NotificationType,
  OrderSide,
  OrderStatus,
  OrderType,
  PaginatedResponse,
  PaginationParams,
  PositionSide,
  TradeExchange,
  TradeSide,
  MetricPayload,
  LatencyMetrics,
} from "../common/index.js";

export type {
  AlertCondition,
  CandleInterval,
  NotificationStatus,
  NotificationType,
  OrderSide,
  OrderStatus,
  OrderType,
  PaginatedResponse,
  PaginationParams,
  PositionSide,
  TradeExchange,
  TradeSide,
  MetricPayload,
  LatencyMetrics,
} from "../common/index.js";

// ==================== Market API Types ====================

export interface MarketSummary {
  symbol: string;
  name: string;
  baseAsset: string;
  quoteAsset: string;
  lastPrice?: number;
  changePercent24h?: number;
  volume24h?: number;
  openInterest?: number;
  fundingRate?: number;
  markPrice?: number;
  indexPrice?: number;
  high24h?: number;
  low24h?: number;
}

export interface MarketDetail extends MarketSummary {
  minOrderSize: number;
  maxOrderSize: number;
  pricePrecision: number;
  sizePrecision: number;
  tickSize: number;
  maintenanceMargin: number;
  initialMargin: number;
  status: "active" | "paused" | "closed";
}

export interface MarketsListResponse {
  markets: MarketSummary[];
}

export interface MarketCandlesRequest extends PaginationParams {
  market: string;
  interval: CandleInterval;
  startTime?: number;
  endTime?: number;
}

export interface MarketCandlesResponse {
  market: string;
  interval: CandleInterval;
  candles: {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[];
}

// ==================== Position API Types ====================

export interface PositionDto {
  id: string;
  userId: string;
  market: string;
  side: PositionSide;
  size: number;
  entryPrice: number;
  markPrice: number;
  liquidationPrice?: number;
  leverage: number;
  margin: number;
  marginRatio?: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  realizedPnl: number;
  openedAt: string;
  lastUpdatedAt: string;
}

export interface PositionUpdateDto {
  leverage?: number;
  margin?: number;
}

export interface PositionCloseDto {
  size?: number; // If not provided, closes entire position
  orderType?: OrderType;
  price?: number; // Required for limit orders
}

export interface PositionsListResponse {
  positions: PositionDto[];
  totalUnrealizedPnl: number;
  totalMarginUsed: number;
}

// ==================== Order API Types ====================

export interface OrderDto {
  id: string;
  userId: string;
  market: string;
  side: OrderSide;
  type: OrderType;
  price: number;
  size: number;
  filledSize: number;
  remainingSize: number;
  status: OrderStatus;
  timeInForce?: "GTC" | "IOC" | "FOK";
  postOnly?: boolean;
  reduceOnly?: boolean;
  stopPrice?: number;
  triggerPrice?: number;
  clientOrderId?: string;
  exchange?: TradeExchange;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

export interface CreateOrderDto {
  market: string;
  side: OrderSide;
  type: OrderType;
  price?: number;
  size: number;
  timeInForce?: "GTC" | "IOC" | "FOK";
  postOnly?: boolean;
  reduceOnly?: boolean;
  stopPrice?: number;
  triggerPrice?: number;
  clientOrderId?: string;
  exchange?: TradeExchange;
}

export interface OrderResponse {
  order: OrderDto;
}

export interface OrdersListResponse extends PaginatedResponse<OrderDto> {}

export interface CancelOrderDto {
  orderId: string;
}

export interface CancelAllOrdersDto {
  market?: string;
}

export interface BatchOrderRequest {
  orders: CreateOrderDto[];
}

export interface BatchOrderResponse {
  orders: OrderDto[];
  errors?: Array<{
    index: number;
    error: string;
  }>;
}

// ==================== Trade History API Types ====================

export interface TradeHistoryDto {
  id: string;
  userId: string;
  orderId?: string;
  market: string;
  side: TradeSide;
  size: number;
  price: number;
  fee: number;
  feeAsset: string;
  pnl: number;
  realizedPnl?: number;
  exchange?: TradeExchange;
  liquidity: "maker" | "taker";
  executedAt: string;
}

export interface TradeHistoryRequest extends PaginationParams {
  market?: string;
  startTime?: string;
  endTime?: string;
}

export type TradeHistoryResponse = PaginatedResponse<TradeHistoryDto>;

// ==================== Funding History API Types ====================

export interface FundingHistoryDto {
  id: string;
  userId: string;
  positionId: string;
  market: string;
  rate: number;
  payment: number;
  positionSize: number;
  time: string;
}

export interface FundingHistoryRequest extends PaginationParams {
  market?: string;
  startTime?: string;
  endTime?: string;
}

export type FundingHistoryResponse = PaginatedResponse<FundingHistoryDto>;

// ==================== Account API Types ====================

export interface AccountSummaryResponse {
  userId: string;
  walletAddress: string;
  balance: number;
  available: number;
  marginUsed: number;
  unrealizedPnl: number;
  equity: number;
  maintenanceMargin: number;
  initialMargin: number;
  marginRatio: number;
  availableCollateral: number;
}

export interface AccountBalance {
  asset: string;
  free: number;
  locked: number;
  total: number;
}

export interface AccountBalancesResponse {
  balances: AccountBalance[];
}

// ==================== User/Me API Types ====================

export interface UserPreferences {
  theme: "light" | "dark" | "system";
  defaultLeverage: number;
  defaultMarket: string;
  favoriteMarkets: string[];
  notifications: {
    email: boolean;
    push: boolean;
    priceAlerts: boolean;
    orderUpdates: boolean;
  };
}

export interface UserDto {
  id: string;
  walletAddress: string;
  username: string | null;
  email: string | null;
  createdAt: string;
  preferences: UserPreferences | null;
}

export interface MeResponse {
  user: UserDto;
}

export interface UpdateUserPreferencesDto {
  theme?: "light" | "dark" | "system";
  defaultLeverage?: number;
  defaultMarket?: string;
  favoriteMarkets?: string[];
  notifications?: Partial<UserPreferences["notifications"]>;
}

// ==================== Alerts API Types ====================

export interface PriceAlert {
  id: string;
  userId: string;
  market: string;
  condition: AlertCondition;
  targetPrice: string;
  triggered: boolean;
  triggeredAt: string | null;
  createdAt: string;
  expiresAt?: string;
}

export interface CreatePriceAlertDto {
  market: string;
  condition: AlertCondition;
  targetPrice: string;
  expiresAt?: string;
}

export interface UpdatePriceAlertDto {
  targetPrice?: string;
  condition?: AlertCondition;
  expiresAt?: string;
}

export type PriceAlertResponse = PaginatedResponse<PriceAlert>;

// ==================== Notifications API Types ====================

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string | null;
  type: NotificationType;
  amount: string | null;
  status: NotificationStatus;
  metadata?: Record<string, unknown>;
  createdAt: string;
  readAt?: string;
}

export interface NotificationsResponse extends PaginatedResponse<NotificationItem> {}

export interface MarkNotificationsReadDto {
  notificationIds?: string[]; // If not provided, marks all as read
}

// ==================== Metrics API Types ====================

export interface MetricsRequest {
  name: string;
  value: number;
  timestamp?: number;
  meta?: Record<string, unknown>;
}

export interface MetricsResponse {
  success: boolean;
}

export interface LatencyResponse {
  api: number;
  ws: number;
  timestamp: number;
}

// ==================== Auth API Types ====================

export interface AuthNonceRequest {
  walletAddress: string;
}

export interface AuthNonceResponse {
  nonce: string;
  message: string;
}

export interface AuthVerifyRequest {
  walletAddress: string;
  signature: string;
  message: string;
}

export interface AuthVerifyResponse {
  token: string;
  user: UserDto;
}

export interface AuthRefreshResponse {
  token: string;
}

// ==================== DEX API Types ====================

export interface DEXMarket {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  price: number;
  volume24h: number;
  liquidity: number;
}

export interface DEXOrderRequest {
  market: string;
  side: OrderSide;
  type: OrderType;
  size: number;
  price?: number;
  slippageTolerance?: number;
}

export interface DEXOrderResponse {
  orderId: string;
  status: "pending" | "confirmed" | "failed";
  txHash?: string;
  filled?: number;
  remaining?: number;
  avgPrice?: number;
  fee?: number;
}

export interface DEXBalance {
  asset: string;
  balance: number;
  locked: number;
}
