import { DurableObject } from "cloudflare:workers";
import type { OrderbookMessage, TickerMessage, TradesMessage } from "@hyperx/types/websocket";
import { toParadexMarketSymbol, fromParadexMarketSymbol } from "@hyperx/types/common";
import type { Env, MarketRoomRpc, MarketTick, ClientHubRpc } from "../types.js";

interface SubscriberRow extends Record<string, any> {
  hub_id: string;
}

export class MarketRoom extends DurableObject<Env> implements MarketRoomRpc {
  private bids = new Map<number, number>();
  private asks = new Map<number, number>();
  private lastTicker: TickerMessage | null = null;
  private market: string = "BTC-USD";
  private network: "testnet" | "mainnet" = "testnet";
  private directWs: WebSocket | null = null;
  private reconnectTimer: any = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.initSql();
  }

  private initSql() {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS subscribers (
        hub_id TEXT PRIMARY KEY
      );
      CREATE TABLE IF NOT EXISTS snapshots (
        key TEXT PRIMARY KEY,
        data TEXT,
        updated_at INTEGER
      );
    `);
  }

  async subscribe(hubId: string, market?: string, network?: "testnet" | "mainnet"): Promise<unknown> {
    if (market) this.market = market;
    if (network) this.network = network;

    this.ctx.storage.sql.exec("INSERT OR IGNORE INTO subscribers (hub_id) VALUES (?)", hubId);

    // If orderbook is empty, populate from Paradex REST API
    if (this.bids.size === 0 && this.market) {
      await this.fetchInitialBook();
    }

    // Connect on-demand outbound Paradex WS if not already connected
    if (!this.directWs && this.market) {
      this.connectParadexWs();
    }

    const bidsSorted = Array.from(this.bids.entries())
      .sort((a, b) => b[0] - a[0])
      .slice(0, 50)
      .map(([price, size]) => ({ price, size }));

    const asksSorted = Array.from(this.asks.entries())
      .sort((a, b) => a[0] - b[0])
      .slice(0, 50)
      .map(([price, size]) => ({ price, size }));

    const snapshot: OrderbookMessage = {
      type: "orderbook",
      market: this.market,
      bids: bidsSorted,
      asks: asksSorted,
      timestamp: Date.now(),
    };

    return snapshot;
  }

  async unsubscribe(hubId: string): Promise<void> {
    this.ctx.storage.sql.exec("DELETE FROM subscribers WHERE hub_id = ?", hubId);
    const subscribers = this.ctx.storage.sql.exec<SubscriberRow>("SELECT hub_id FROM subscribers").toArray();
    if (subscribers.length === 0) {
      this.disconnectParadexWs();
    }
  }

  async applyTicks(ticks: MarketTick[]): Promise<void> {
    // If an external high-throughput daemon (Fly.io) is feeding ticks, tear down direct socket
    if (this.directWs) {
      this.disconnectParadexWs();
    }

    const rows = this.ctx.storage.sql.exec<SubscriberRow>("SELECT hub_id FROM subscribers").toArray();
    const activeHubIds = rows.map((r) => r.hub_id);

    for (const tick of ticks) {
      this.market = tick.market;
      this.network = tick.network;

      if (tick.channel === "orderbook") {
        for (const [p, s] of tick.bids) {
          const price = parseFloat(p);
          const size = parseFloat(s);
          if (size === 0) {
            this.bids.delete(price);
          } else {
            this.bids.set(price, size);
          }
        }
        for (const [p, s] of tick.asks) {
          const price = parseFloat(p);
          const size = parseFloat(s);
          if (size === 0) {
            this.asks.delete(price);
          } else {
            this.asks.set(price, size);
          }
        }

        if (activeHubIds.length > 0) {
          const msg: OrderbookMessage & { channelKey: string } = {
            type: "orderbook",
            market: tick.market,
            bids: tick.bids.map(([price, size]) => ({ price: parseFloat(price), size: parseFloat(size) })),
            asks: tick.asks.map(([price, size]) => ({ price: parseFloat(price), size: parseFloat(size) })),
            sequence: tick.sequence,
            timestamp: tick.ts,
            channelKey: `orderbook:${tick.market}:${tick.network}`,
          };
          await this.fanoutToHubs(activeHubIds, msg);
        }
      } else if (tick.channel === "ticker") {
        const msg: TickerMessage & { channelKey: string } = {
          type: "ticker",
          market: tick.market,
          lastPrice: tick.price ?? 0,
          changePercent24h: tick.change24h ?? 0,
          volume24h: tick.volume24h ?? 0,
          openInterest: 0,
          fundingRate: 0,
          timestamp: tick.ts,
          channelKey: `ticker:${tick.market}:${tick.network}`,
        };
        this.lastTicker = msg;
        if (activeHubIds.length > 0) {
          await this.fanoutToHubs(activeHubIds, msg);
        }
      } else if (tick.channel === "trades") {
        if (activeHubIds.length > 0) {
          const msg: TradesMessage & { channelKey: string } = {
            type: "trades",
            market: tick.market,
            trades: tick.trades.map((t) => ({
              id: t.id,
              side: t.side,
              price: t.price,
              size: t.size,
              timestamp: t.ts,
            })),
            timestamp: tick.ts,
            channelKey: `trades:${tick.market}:${tick.network}`,
          };
          await this.fanoutToHubs(activeHubIds, msg);
        }
      }
    }
  }

  private async fetchInitialBook() {
    try {
      const baseUrl = this.network === "mainnet" ? "https://api.paradex.trade/v1" : "https://api.testnet.paradex.trade/v1";
      const paradexMarket = toParadexMarketSymbol(this.market);
      const res = await fetch(`${baseUrl}/orderbook/${paradexMarket}`);
      if (!res.ok) return;

      const data = await res.json() as any;
      if (Array.isArray(data.bids)) {
        for (const [p, s] of data.bids) {
          this.bids.set(parseFloat(p), parseFloat(s));
        }
      }
      if (Array.isArray(data.asks)) {
        for (const [p, s] of data.asks) {
          this.asks.set(parseFloat(p), parseFloat(s));
        }
      }
    } catch {}
  }

  private connectParadexWs() {
    if (this.directWs || !this.market) return;

    const wsUrl = this.network === "mainnet" ? "wss://ws.paradex.trade/v1" : "wss://ws.testnet.paradex.trade/v1";
    const paradexMarket = toParadexMarketSymbol(this.market);

    try {
      const ws = new WebSocket(wsUrl);
      this.directWs = ws;

      ws.addEventListener("open", () => {
        // Subscribe to orderbook
        ws.send(JSON.stringify({
          id: 1,
          jsonrpc: "2.0",
          method: "subscribe",
          params: { channel: `order_book.${paradexMarket}` },
        }));
        // Subscribe to trades
        ws.send(JSON.stringify({
          id: 2,
          jsonrpc: "2.0",
          method: "subscribe",
          params: { channel: `trades.${paradexMarket}` },
        }));
        // Subscribe to markets summary
        ws.send(JSON.stringify({
          id: 3,
          jsonrpc: "2.0",
          method: "subscribe",
          params: { channel: "markets_summary" },
        }));
      });

      ws.addEventListener("message", (event) => {
        this.handleParadexMessage(typeof event.data === "string" ? event.data : new TextDecoder().decode(event.data));
      });

      ws.addEventListener("close", () => {
        this.directWs = null;
        const subscribers = this.ctx.storage.sql.exec<SubscriberRow>("SELECT hub_id FROM subscribers").toArray();
        if (subscribers.length > 0) {
          this.scheduleReconnect();
        }
      });

      ws.addEventListener("error", () => {
        // Handled in close
      });
    } catch {}
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      const subscribers = this.ctx.storage.sql.exec<SubscriberRow>("SELECT hub_id FROM subscribers").toArray();
      if (subscribers.length > 0 && !this.directWs) {
        this.connectParadexWs();
      }
    }, 2000);
  }

  private disconnectParadexWs() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.directWs) {
      try {
        this.directWs.close();
      } catch {}
      this.directWs = null;
    }
  }

  private async handleParadexMessage(raw: string) {
    try {
      const parsed = JSON.parse(raw);
      const params = parsed.params;
      if (!params || !params.channel || !params.data) return;

      const channel = String(params.channel);
      const data = params.data;

      const rows = this.ctx.storage.sql.exec<SubscriberRow>("SELECT hub_id FROM subscribers").toArray();
      const activeHubIds = rows.map((r) => r.hub_id);
      if (activeHubIds.length === 0) return;

      if (channel.startsWith("order_book.")) {
        const bids: [string, string][] = (data.bids ?? []).map((b: [string, string]) => [String(b[0]), String(b[1])]);
        const asks: [string, string][] = (data.asks ?? []).map((a: [string, string]) => [String(a[0]), String(a[1])]);

        for (const [p, s] of bids) {
          const price = parseFloat(p);
          const size = parseFloat(s);
          if (size === 0) this.bids.delete(price); else this.bids.set(price, size);
        }
        for (const [p, s] of asks) {
          const price = parseFloat(p);
          const size = parseFloat(s);
          if (size === 0) this.asks.delete(price); else this.asks.set(price, size);
        }

        const msg: OrderbookMessage & { channelKey: string } = {
          type: "orderbook",
          market: this.market,
          bids: bids.map(([p, s]) => ({ price: parseFloat(p), size: parseFloat(s) })),
          asks: asks.map(([p, s]) => ({ price: parseFloat(p), size: parseFloat(s) })),
          sequence: Number(data.seq_no ?? 0),
          timestamp: Date.now(),
          channelKey: `orderbook:${this.market}:${this.network}`,
        };
        await this.fanoutToHubs(activeHubIds, msg);
      } else if (channel === "markets_summary") {
        const symbol = String(data.symbol ?? data.market ?? "");
        const normalized = fromParadexMarketSymbol(symbol);
        if (normalized === this.market || symbol.includes(this.market)) {
          const msg: TickerMessage & { channelKey: string } = {
            type: "ticker",
            market: this.market,
            lastPrice: Number(data.last_traded_price ?? data.last_price ?? 0),
            changePercent24h: Number(data.price_change_rate_24h ?? data.change_percent_24h ?? 0),
            volume24h: Number(data.volume_24h ?? data.total_volume ?? 0),
            openInterest: 0,
            fundingRate: 0,
            timestamp: Date.now(),
            channelKey: `ticker:${this.market}:${this.network}`,
          };
          this.lastTicker = msg;
          await this.fanoutToHubs(activeHubIds, msg);
        }
      } else if (channel.startsWith("trades.")) {
        const rawTrades = Array.isArray(data) ? data : [data];
        const msg: TradesMessage & { channelKey: string } = {
          type: "trades",
          market: this.market,
          trades: rawTrades.map((t: any) => ({
            id: String(t.id ?? Date.now()),
            side: (t.side || "buy").toLowerCase() === "buy" ? "buy" : "sell",
            price: Number(t.price ?? 0),
            size: Number(t.size ?? 0),
            timestamp: Number(t.created_at ?? Date.now()),
          })),
          timestamp: Date.now(),
          channelKey: `trades:${this.market}:${this.network}`,
        };
        await this.fanoutToHubs(activeHubIds, msg);
      }
    } catch {}
  }

  private async fanoutToHubs(hubIds: string[], msg: any) {
    for (const hubId of hubIds) {
      try {
        const hubStub = this.env.CLIENT_HUB.get(this.env.CLIENT_HUB.idFromName(hubId)) as unknown as ClientHubRpc;
        await hubStub.fanout(msg);
      } catch (err) {
        console.warn(`[MarketRoom] Failed fanout to ${hubId}:`, (err as Error).message);
      }
    }
  }
}
