import type { ServerMessage } from "@hyperx/types/websocket";

export type MarketTick =
  | {
      channel: "orderbook";
      network: "testnet" | "mainnet";
      market: string;
      bids: [string, string][];
      asks: [string, string][];
      sequence?: number;
      ts: number;
    }
  | {
      channel: "ticker";
      network: "testnet" | "mainnet";
      market: string;
      price?: number;
      volume24h?: number;
      change24h?: number;
      ts: number;
    }
  | {
      channel: "trades";
      network: "testnet" | "mainnet";
      market: string;
      trades: Array<{
        id: string;
        price: number;
        size: number;
        side: "buy" | "sell";
        ts: number;
      }>;
      ts: number;
    };

export interface Env {
  CLIENT_HUB: DurableObjectNamespace;
  MARKET_ROOM: DurableObjectNamespace;
  ACCOUNT_HUB: DurableObjectNamespace;
  JWT_SECRET: string;
  INGEST_HMAC_SECRET: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
}

export type ChannelKey = string; // e.g. "orderbook:BTC-USD:testnet" or "account:<userId>"

export interface ClientAttachment {
  userId?: string;
  tokenVersion?: number;
  subs: string[];
  hubId: string;
}

export interface ClientHubRpc {
  fanout(msg: ServerMessage & { channelKey: string }): Promise<void>;
  requestParadexRefresh(userId: string): Promise<void>;
  dropAccount(userId: string): Promise<void>;
}

export interface MarketRoomRpc {
  subscribe(hubId: string): Promise<unknown>;
  unsubscribe(hubId: string): Promise<void>;
  applyTicks(ticks: MarketTick[]): Promise<void>;
}

export interface AccountHubRpc {
  subscribe(hubId: string, userId: string): Promise<unknown>;
  unsubscribe(hubId: string): Promise<void>;
  pushParadexJwt(jwt: string, expiresAt: number): Promise<void>;
  revoke(userId: string): Promise<void>;
}
