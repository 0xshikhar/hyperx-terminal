import { WSClient } from "./WSClient";

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:3002";

export const wsClient = new WSClient({
  url: WS_URL,
});

export { WSClient } from "./WSClient";
export type { ConnectionState } from "./WSClient";
export type {
  Candle,
  CandleInterval,
  CandlesMessage,
  CandlesChannel,
  WSChannel,
  ServerMessage,
  ClientMessage,
  TickerMessage,
  OrderbookMessage,
  TradesMessage,
  StatusMessage,
  ChannelPayloadMap,
} from "./channelTypes";
export { candleIntervals, makeCandlesChannel } from "./channelTypes";
