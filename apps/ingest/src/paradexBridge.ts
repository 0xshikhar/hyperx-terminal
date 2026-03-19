import WebSocket from "ws";
import type { TickBatcher, MarketTick } from "./batcher.js";

const CORE_MARKETS = [
  "BTC-USD-PERP",
  "ETH-USD-PERP",
  "SOL-USD-PERP",
  "STRK-USD-PERP",
  "HYPE-USD-PERP",
];

export interface ParadexBridgeOptions {
  network: "testnet" | "mainnet";
  wsUrl: string;
  batcher: TickBatcher;
  reconnectBaseMs?: number;
  reconnectMaxMs?: number;
}

export function fromParadexMarket(symbol: string): string {
  if (!symbol) return "";
  if (symbol.endsWith("-PERP")) {
    return symbol.slice(0, -5);
  }
  return symbol;
}

export class ParadexIngestBridge {
  private ws: WebSocket | null = null;
  private isRunning = false;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private readonly network: "testnet" | "mainnet";
  private readonly wsUrl: string;
  private readonly batcher: TickBatcher;
  private readonly reconnectBaseMs: number;
  private readonly reconnectMaxMs: number;
  private nextId = 1;

  constructor(options: ParadexBridgeOptions) {
    this.network = options.network;
    this.wsUrl = options.wsUrl;
    this.batcher = options.batcher;
    this.reconnectBaseMs = options.reconnectBaseMs ?? 1000;
    this.reconnectMaxMs = options.reconnectMaxMs ?? 30000;
  }

  public start() {
    this.isRunning = true;
    this.connect();
  }

  private connect() {
    if (!this.isRunning) return;

    try {
      console.log(`[ParadexBridge:${this.network}] Connecting to ${this.wsUrl}...`);
      this.ws = new WebSocket(this.wsUrl);

      this.ws.on("open", () => {
        console.log(`[ParadexBridge:${this.network}] Connected successfully.`);
        this.reconnectAttempts = 0;
        this.subscribeCoreMarkets();
      });

      this.ws.on("message", (data: WebSocket.RawData) => {
        this.handleMessage(data.toString());
      });

      this.ws.on("error", (err: Error) => {
        console.warn(`[ParadexBridge:${this.network}] Error:`, err.message);
      });

      this.ws.on("close", () => {
        console.warn(`[ParadexBridge:${this.network}] Socket closed.`);
        this.ws = null;
        this.scheduleReconnect();
      });
    } catch (err) {
      console.error(`[ParadexBridge:${this.network}] Connect error:`, (err as Error).message);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (!this.isRunning || this.reconnectTimer) return;

    // Exponential backoff with jitter
    const exp = Math.min(this.reconnectAttempts, 5);
    const delay = Math.min(
      this.reconnectMaxMs,
      this.reconnectBaseMs * Math.pow(2, exp) + Math.random() * 1000
    );
    this.reconnectAttempts++;

    console.log(`[ParadexBridge:${this.network}] Reconnecting in ${Math.round(delay)}ms...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private send(payload: Record<string, unknown>) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(payload));
  }

  private subscribeCoreMarkets() {
    // 1. Markets summary (ticker)
    this.send({
      id: this.nextId++,
      jsonrpc: "2.0",
      method: "subscribe",
      params: { channel: "markets_summary" },
    });

    // 2. Order book for core markets
    for (const market of CORE_MARKETS) {
      this.send({
        id: this.nextId++,
        jsonrpc: "2.0",
        method: "subscribe",
        params: { channel: `order_book.${market}` },
      });
    }
  }

  private handleMessage(raw: string) {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;

      const params = parsed.params;
      if (!params || !params.channel || !params.data) return;

      const channel = String(params.channel);
      const data = params.data;

      if (channel === "markets_summary") {
        const market = fromParadexMarket(String(data.symbol ?? data.market ?? ""));
        if (!market) return;

        this.batcher.push({
          channel: "ticker",
          network: this.network,
          market,
          price: Number(data.last_traded_price ?? data.last_price ?? 0),
          volume24h: Number(data.volume_24h ?? data.total_volume ?? 0),
          change24h: Number(data.price_change_rate_24h ?? data.change_percent_24h ?? 0),
          ts: Date.now(),
        });
      } else if (channel.startsWith("order_book.")) {
        const rawMarket = channel.slice("order_book.".length);
        const market = fromParadexMarket(rawMarket);
        const bids: [string, string][] = (data.bids ?? []).map((b: [string, string]) => [
          String(b[0]),
          String(b[1]),
        ]);
        const asks: [string, string][] = (data.asks ?? []).map((a: [string, string]) => [
          String(a[0]),
          String(a[1]),
        ]);

        this.batcher.push({
          channel: "orderbook",
          network: this.network,
          market,
          bids,
          asks,
          sequence: Number(data.seq_no ?? 0),
          ts: Date.now(),
        });
      }
    } catch {
      // Ignore unparseable frames
    }
  }

  public stop() {
    this.isRunning = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
