/**
 * WebSocket message types for real-time data streaming
 */

import type { CandleInterval, OrderSide } from "../common/index.js";

// Base WebSocket message types
export interface WSMessageBase {
  type: string;
  timestamp: number;
}

// Channel definitions
export type SubscribableChannel = "ticker" | "orderbook" | "trades" | "status" | "candles" | "account";

export type CandlesChannel = `candles:${CandleInterval}`;

export type WSChannel = SubscribableChannel | CandlesChannel | "pong";

// Subscribe/Unsubscribe messages (Client -> Server)
export interface SubscribeMessage {
  type: "subscribe";
  channels: Array<{
    channel: SubscribableChannel | CandlesChannel;
    market?: string;
  }>;
}

export interface UnsubscribeMessage {
  type: "unsubscribe";
  channels: Array<{
    channel: SubscribableChannel | CandlesChannel;
    market?: string;
  }>;
}

export interface PingMessage {
  type: "ping";
  timestamp: number;
}

export interface PongMessage {
  type: "pong";
  timestamp: number;
}

// Server -> Client message payloads
export interface TickerMessage extends WSMessageBase {
  type: "ticker";
  market: string;
  lastPrice: number;
  changePercent24h: number;
  volume24h: number;
  openInterest: number;
  fundingRate: number;
}

export interface OrderbookLevel {
  price: number;
  size: number;
  orders?: number;
}

export interface OrderbookMessage extends WSMessageBase {
  type: "orderbook";
  market: string;
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  sequence?: number;
}

export interface TradeMessage {
  id: string;
  side: OrderSide;
  price: number;
  size: number;
  timestamp: number;
}

export interface TradesMessage extends WSMessageBase {
  type: "trades";
  market: string;
  trades: TradeMessage[];
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface CandlesMessage extends WSMessageBase {
  type: "candles";
  market: string;
  interval: CandleInterval | string;
  candles: Candle[];
}

export interface StatusMessage extends WSMessageBase {
  type: "status";
  blockHeight?: number;
  gasPrice?: string;
  network?: "testnet" | "mainnet";
  networkStatus?: "healthy" | "degraded" | "down";
}

export interface AccountUpdateMessage extends WSMessageBase {
  type: "account";
  userId: string;
  balance?: number;
  marginUsed?: number;
  unrealizedPnl?: number;
  positions?: PositionUpdate[];
  orders?: OrderUpdate[];
}

export interface PositionUpdate {
  id: string;
  market: string;
  side: "long" | "short";
  size: number;
  entryPrice: number;
  markPrice: number;
  leverage: number;
  margin: number;
  pnl: number;
  pnlPercent: number;
}

export interface OrderUpdate {
  id: string;
  market: string;
  side: OrderSide;
  type: "limit" | "market" | "stop";
  price: number;
  size: number;
  filledSize: number;
  status: string;
}

// Union types for client and server messages
export type ClientMessage = SubscribeMessage | UnsubscribeMessage | PingMessage;

export type ServerMessage =
  | TickerMessage
  | OrderbookMessage
  | TradesMessage
  | CandlesMessage
  | StatusMessage
  | AccountUpdateMessage
  | PongMessage;

// Channel to message type mapping
export interface ChannelPayloadMap {
  ticker: TickerMessage;
  orderbook: OrderbookMessage;
  trades: TradesMessage;
  status: StatusMessage;
  candles: CandlesMessage;
  account: AccountUpdateMessage;
  pong: PongMessage;
}

// Subscription management
export interface Subscription {
  id: string;
  channel: WSChannel;
  market?: string;
  userId?: string;
  createdAt: number;
}

export interface SubscriptionRequest {
  channel: WSChannel;
  market?: string;
}
