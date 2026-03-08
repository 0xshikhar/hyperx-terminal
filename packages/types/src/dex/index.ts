/**
 * DEX (Decentralized Exchange) integration types
 */

import type {
  OrderSide,
  OrderType,
  SupportedNetwork,
  DEXOrderStatus,
} from "../common/index.js";

export type { OrderSide, OrderType, SupportedNetwork, DEXOrderStatus } from "../common/index.js";

// ==================== Base DEX Types ====================

export interface DEXConfig {
  name: string;
  baseUrl: string;
  chainId: number;
  network: SupportedNetwork;
  apiKey?: string;
  timeout?: number;
  rateLimit?: {
    requests: number;
    windowMs: number;
  };
}

export interface DEXCredentials {
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
}

// ==================== Extended DEX Types ====================

export interface ExtendedMarket {
  symbol: string;
  status: "active" | "paused" | "delisted";
  baseAsset: string;
  quoteAsset: string;
  pricePrecision: number;
  quantityPrecision: number;
  tickSize: string;
  stepSize: string;
  minNotional: string;
  maxNotional: string;
  minQuantity: string;
  maxQuantity: string;
}

export interface ExtendedOrderbook {
  symbol: string;
  bids: [string, string][]; // [price, quantity]
  asks: [string, string][];
  lastUpdateId: number;
}

export interface ExtendedOrder {
  orderId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  price: string;
  quantity: string;
  executedQty: string;
  status: DEXOrderStatus;
  timeInForce: "GTC" | "IOC" | "FOK";
  createdAt: number;
  updatedAt: number;
}

export interface ExtendedTrade {
  tradeId: string;
  orderId: string;
  symbol: string;
  side: OrderSide;
  price: string;
  quantity: string;
  commission: string;
  commissionAsset: string;
  timestamp: number;
  isMaker: boolean;
}

export interface ExtendedBalance {
  asset: string;
  free: string;
  locked: string;
  total: string;
}

export interface ExtendedAccountInfo {
  makerCommission: number;
  takerCommission: number;
  buyerCommission: number;
  sellerCommission: number;
  balances: ExtendedBalance[];
}

export interface ExtendedCreateOrderRequest {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  timeInForce?: "GTC" | "IOC" | "FOK";
  quantity: string;
  price?: string;
  stopPrice?: string;
  newClientOrderId?: string;
}

// ==================== Paradex DEX Types ====================

export interface ParadexMarket {
  market: string;
  baseCurrency: string;
  quoteCurrency: string;
  pricePrecision: number;
  quantityPrecision: number;
  minQuantity: string;
  maxQuantity: string;
  status: "ACTIVE" | "PAUSED" | "CLOSED";
}

export interface ParadexOrderbook {
  market: string;
  bids: ParadexOrderbookLevel[];
  asks: ParadexOrderbookLevel[];
  timestamp: number;
}

export interface ParadexOrderbookLevel {
  price: string;
  size: string;
  orders: number;
}

export interface ParadexOrder {
  id: string;
  market: string;
  side: "BUY" | "SELL";
  type: "LIMIT" | "MARKET" | "STOP_LIMIT" | "STOP_MARKET";
  size: string;
  price?: string;
  remainingSize: string;
  status: "OPEN" | "PARTIAL" | "FILLED" | "CANCELED" | "PENDING";
  timeInForce: "GTC" | "IOC" | "FOK";
  postOnly: boolean;
  reduceOnly: boolean;
  createdAt: string;
  expiresAt?: string;
}

export interface ParadexTrade {
  id: string;
  market: string;
  side: "BUY" | "SELL";
  size: string;
  price: string;
  fee: string;
  feeCurrency: string;
  liquidity: "MAKER" | "TAKER";
  timestamp: string;
}

export interface ParadexPosition {
  market: string;
  side: "LONG" | "SHORT";
  size: string;
  entryPrice: string;
  markPrice: string;
  unrealizedPnl: string;
  margin: string;
  liquidationPrice: string;
  leverage: string;
}

export interface ParadexBalance {
  currency: string;
  available: string;
  held: string;
  total: string;
}

export interface ParadexCreateOrderRequest {
  market: string;
  side: "BUY" | "SELL";
  type: "LIMIT" | "MARKET" | "STOP_LIMIT" | "STOP_MARKET";
  size: string;
  price?: string;
  timeInForce?: "GTC" | "IOC" | "FOK";
  postOnly?: boolean;
  reduceOnly?: boolean;
  stopPrice?: string;
  clientId?: string;
}

// ==================== Order Routing Types ====================

export interface RouteRequest {
  market: string;
  side: OrderSide;
  size: number;
  price?: number;
  type: OrderType;
  preferredExchange?: string;
  allowSplit?: boolean;
}

export interface RouteLeg {
  exchange: string;
  size: number;
  price: number;
  fee: number;
  estimatedSlippage: number;
}

export interface RouteResult {
  requestId: string;
  market: string;
  side: OrderSide;
  totalSize: number;
  averagePrice: number;
  totalFee: number;
  estimatedSlippage: number;
  legs: RouteLeg[];
  bestExchange: string;
  timestamp: number;
}

export interface OrderRouteDecision {
  requestId: string;
  primaryExchange: string;
  backupExchanges: string[];
  splitExecution: boolean;
  legs: RouteLeg[];
  reasoning: string;
}

// ==================== DEX Aggregator Types ====================

export interface DEXQuoteRequest {
  fromAsset: string;
  toAsset: string;
  amount: string;
  side: "buy" | "sell";
}

export interface DEXQuote {
  exchange: string;
  fromAsset: string;
  toAsset: string;
  fromAmount: string;
  toAmount: string;
  price: string;
  fee: string;
  slippage: string;
  expiresAt: number;
}

export interface DEXSwapRequest {
  quoteId: string;
  walletAddress: string;
  slippageTolerance?: number;
}

export interface DEXSwapResult {
  swapId: string;
  status: "pending" | "confirmed" | "failed";
  txHash?: string;
  fromAmount: string;
  toAmount: string;
  fee: string;
  executedAt?: string;
}

// ==================== WebSocket Streaming Types ====================

export interface DEXStreamConfig {
  exchange: string;
  markets: string[];
  channels: ("ticker" | "orderbook" | "trades")[];
}

export interface DEXStreamMessage {
  exchange: string;
  channel: string;
  market: string;
  data: unknown;
  timestamp: number;
}
