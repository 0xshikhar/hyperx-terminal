import { DurableObject } from "cloudflare:workers";
import type { OrderbookMessage, TickerMessage, TradesMessage } from "@hyperx/types/websocket";
import type { Env, MarketRoomRpc, MarketTick, ClientHubRpc } from "../types.js";

interface SubscriberRow extends Record<string, any> {
  hub_id: string;
}

export class MarketRoom extends DurableObject<Env> implements MarketRoomRpc {
  private bids = new Map<number, number>();
  private asks = new Map<number, number>();
  private lastTicker: TickerMessage | null = null;
  private market: string = "";

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

  async subscribe(hubId: string): Promise<unknown> {
    this.ctx.storage.sql.exec("INSERT OR IGNORE INTO subscribers (hub_id) VALUES (?)", hubId);

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
  }

  async applyTicks(ticks: MarketTick[]): Promise<void> {
    const rows = this.ctx.storage.sql.exec<SubscriberRow>("SELECT hub_id FROM subscribers").toArray();
    const activeHubIds = rows.map((r) => r.hub_id);

    for (const tick of ticks) {
      this.market = tick.market;

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
