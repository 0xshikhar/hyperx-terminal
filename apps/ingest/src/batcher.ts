import { createHmac } from "node:crypto";

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

export interface BatcherOptions {
  targetUrl: string;
  hmacSecret: string;
  flushIntervalMs?: number;
  maxBatchSize?: number;
}

export class TickBatcher {
  private buffer: MarketTick[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly targetUrl: string;
  private readonly hmacSecret: string;
  private readonly flushIntervalMs: number;
  private readonly maxBatchSize: number;
  private isFlushing = false;

  constructor(options: BatcherOptions) {
    this.targetUrl = options.targetUrl.replace(/\/+$/, "");
    this.hmacSecret = options.hmacSecret;
    this.flushIntervalMs = options.flushIntervalMs ?? 50;
    this.maxBatchSize = options.maxBatchSize ?? 200;
  }

  public push(tick: MarketTick) {
    this.buffer.push(tick);
    if (this.buffer.length >= this.maxBatchSize) {
      void this.flush();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => void this.flush(), this.flushIntervalMs);
    }
  }

  public async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.buffer.length === 0 || this.isFlushing) return;

    this.isFlushing = true;
    const ticksToSend = this.buffer.splice(0, this.maxBatchSize);

    try {
      const now = Date.now();
      const payload = JSON.stringify({ ticks: ticksToSend });

      const hmac = createHmac("sha256", this.hmacSecret);
      hmac.update(`${now}.${payload}`);
      const signature = `sha256=${hmac.digest("hex")}`;

      const res = await fetch(`${this.targetUrl}/internal/ticks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hyperx-timestamp": String(now),
          "x-hyperx-ingest": signature,
        },
        body: payload,
      });

      if (!res.ok) {
        const text = await res.text();
        console.warn(`[TickBatcher] Flush failed (${res.status}): ${text}`);
      }
    } catch (err) {
      console.error("[TickBatcher] Network error flushing ticks:", (err as Error).message);
    } finally {
      this.isFlushing = false;
      if (this.buffer.length > 0 && !this.flushTimer) {
        this.flushTimer = setTimeout(() => void this.flush(), this.flushIntervalMs);
      }
    }
  }

  public stop() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }
}
