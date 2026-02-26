export type WSChannel = "ticker" | "orderbook" | "trades" | "status" | "pong";

export type SubscribableChannel = Exclude<WSChannel, "pong">;

export type SubscribeMessage = {
  type: "subscribe";
  channels: { channel: SubscribableChannel; market?: string }[];
};

export type UnsubscribeMessage = {
  type: "unsubscribe";
  channels: { channel: SubscribableChannel; market?: string }[];
};

export type ClientMessage = SubscribeMessage | UnsubscribeMessage | { type: "ping"; timestamp: number };

export type TickerMessage = {
  type: "ticker";
  market: string;
  lastPrice: number;
  changePercent24h: number;
  volume24h: number;
  openInterest: number;
  fundingRate: number;
  timestamp: number;
};

export type OrderbookMessage = {
  type: "orderbook";
  market: string;
  bids: { price: number; size: number }[];
  asks: { price: number; size: number }[];
  timestamp: number;
};

export type TradesMessage = {
  type: "trades";
  market: string;
  trades: { id: string; side: "buy" | "sell"; price: number; size: number; timestamp: number }[];
  timestamp: number;
};

export type StatusMessage = {
  type: "status";
  blockHeight?: number;
  gasPrice?: string;
  timestamp: number;
};

export type PongMessage = { type: "pong"; timestamp: number };

export type ServerMessage = TickerMessage | OrderbookMessage | TradesMessage | StatusMessage | PongMessage;
