export type CandleInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

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

export type CandlesMessage = {
  type: "candles";
  market: string;
  interval: CandleInterval | string;
  candles: Candle[];
  timestamp: number;
};

export type PongMessage = { type: "pong"; timestamp: number };

export type ChannelPayloadMap = {
  ticker: TickerMessage;
  orderbook: OrderbookMessage;
  trades: TradesMessage;
  status: StatusMessage;
  candles: CandlesMessage;
  pong: PongMessage;
};

export type WSChannel = keyof ChannelPayloadMap;

export type SubscribableChannel = Exclude<WSChannel, "pong">;

export type CandlesChannel = `candles:${string}:${CandleInterval | string}`;

export const candleIntervals: CandleInterval[] = ["1m", "5m", "15m", "1h", "4h", "1d"];

export const makeCandlesChannel = (market: string, interval: CandleInterval) =>
  `candles:${market}:${interval}` as const;

export type SubscribeMessage = {
  type: "subscribe";
  channels: { channel: SubscribableChannel | CandlesChannel; market?: string }[];
};

export type UnsubscribeMessage = {
  type: "unsubscribe";
  channels: { channel: SubscribableChannel | CandlesChannel; market?: string }[];
};

export type ClientMessage = SubscribeMessage | UnsubscribeMessage | { type: "ping"; timestamp: number };

export type ServerMessage = ChannelPayloadMap[WSChannel];
