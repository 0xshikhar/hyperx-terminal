import { DurableObject } from "cloudflare:workers";
import type { AccountUpdateMessage, OrderUpdate, PositionUpdate } from "@hyperx/types/websocket";
import type { Env, AccountHubRpc, ClientHubRpc } from "../types.js";

interface SubscriberRow extends Record<string, any> {
  hub_id: string;
}

interface AuthStateRow extends Record<string, any> {
  key: string;
  jwt: string;
  expires_at: number;
}

export class AccountHub extends DurableObject<Env> implements AccountHubRpc {
  private userId: string = "";
  private paradexWs: WebSocket | null = null;
  private paradexWsAuthed: boolean = false;
  private jwt: string | null = null;
  private expiresAt: number = 0;
  private network: "testnet" | "mainnet" = "testnet";

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.initSql();
    this.restoreState();
  }

  private initSql() {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS subscribers (
        hub_id TEXT PRIMARY KEY
      );
      CREATE TABLE IF NOT EXISTS auth_state (
        key TEXT PRIMARY KEY,
        jwt TEXT,
        expires_at INTEGER
      );
    `);
  }

  private restoreState() {
    const rows = this.ctx.storage.sql.exec<AuthStateRow>("SELECT key, jwt, expires_at FROM auth_state WHERE key = 'session'").toArray();
    if (rows.length > 0) {
      this.jwt = rows[0].jwt;
      this.expiresAt = rows[0].expires_at;
    }
  }

  async subscribe(hubId: string, userId: string): Promise<unknown> {
    this.userId = userId;
    this.ctx.storage.sql.exec("INSERT OR IGNORE INTO subscribers (hub_id) VALUES (?)", hubId);

    // Schedule periodic heartbeat / expiry check
    await this.ctx.storage.setAlarm(Date.now() + 30000);

    // Ensure outbound Paradex socket is connected if we have JWT
    if (!this.paradexWs && this.jwt) {
      this.connectParadexWs();
    }

    return { ok: true, userId: this.userId };
  }

  async unsubscribe(hubId: string): Promise<void> {
    this.ctx.storage.sql.exec("DELETE FROM subscribers WHERE hub_id = ?", hubId);
    const subscribers = this.ctx.storage.sql.exec<SubscriberRow>("SELECT hub_id FROM subscribers").toArray();
    if (subscribers.length === 0 && this.paradexWs) {
      this.disconnectParadexWs();
    }
  }

  async pushParadexJwt(jwt: string, expiresAt: number): Promise<void> {
    this.jwt = jwt;
    this.expiresAt = expiresAt;
    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO auth_state (key, jwt, expires_at) VALUES ('session', ?, ?)",
      jwt,
      expiresAt
    );

    // If socket is open, reconnect or re-auth
    if (this.paradexWs) {
      this.disconnectParadexWs();
    }

    const subscribers = this.ctx.storage.sql.exec<SubscriberRow>("SELECT hub_id FROM subscribers").toArray();
    if (subscribers.length > 0) {
      this.connectParadexWs();
    }
  }

  async revoke(userId: string): Promise<void> {
    this.disconnectParadexWs();
    this.jwt = null;
    this.expiresAt = 0;
    this.ctx.storage.sql.exec("DELETE FROM auth_state");

    const subscribers = this.ctx.storage.sql.exec<SubscriberRow>("SELECT hub_id FROM subscribers").toArray();
    for (const sub of subscribers) {
      try {
        const hubStub = this.env.CLIENT_HUB.get(this.env.CLIENT_HUB.idFromName(sub.hub_id)) as unknown as ClientHubRpc;
        await hubStub.dropAccount(userId);
      } catch {}
    }
    this.ctx.storage.sql.exec("DELETE FROM subscribers");
  }

  async alarm(): Promise<void> {
    const subscribers = this.ctx.storage.sql.exec<SubscriberRow>("SELECT hub_id FROM subscribers").toArray();
    if (subscribers.length === 0) {
      this.disconnectParadexWs();
      return;
    }

    // Check if token expires within 5 minutes
    const now = Date.now();
    if (this.expiresAt > 0 && this.expiresAt - now < 300000) {
      for (const sub of subscribers) {
        try {
          const hubStub = this.env.CLIENT_HUB.get(this.env.CLIENT_HUB.idFromName(sub.hub_id)) as unknown as ClientHubRpc;
          await hubStub.requestParadexRefresh(this.userId);
        } catch {}
      }
    }

    // Ensure connection is active
    if (!this.paradexWs && this.jwt) {
      this.connectParadexWs();
    }

    // Schedule next check in 30s
    await this.ctx.storage.setAlarm(Date.now() + 30000);
  }

  private connectParadexWs() {
    if (!this.jwt) return;

    const wsUrl = this.network === "mainnet" ? "wss://ws.paradex.trade/v1" : "wss://ws.testnet.paradex.trade/v1";

    try {
      const ws = new WebSocket(wsUrl);
      this.paradexWs = ws;
      this.paradexWsAuthed = false;

      ws.addEventListener("open", () => {
        // Authenticate outbound connection
        ws.send(
          JSON.stringify({
            id: 1,
            method: "auth",
            params: { bearer: this.jwt },
          })
        );
      });

      ws.addEventListener("message", (event) => {
        this.handleParadexMessage(typeof event.data === "string" ? event.data : new TextDecoder().decode(event.data));
      });

      ws.addEventListener("close", () => {
        this.paradexWs = null;
        this.paradexWsAuthed = false;
      });

      ws.addEventListener("error", (err) => {
        console.warn(`[AccountHub] Paradex WS error for ${this.userId}:`, err);
      });
    } catch (err) {
      console.error(`[AccountHub] Failed connecting Paradex WS:`, err);
    }
  }

  private disconnectParadexWs() {
    if (this.paradexWs) {
      try {
        this.paradexWs.close();
      } catch {}
      this.paradexWs = null;
      this.paradexWsAuthed = false;
    }
  }

  private async handleParadexMessage(data: string) {
    let parsed: any;
    try {
      parsed = JSON.parse(data);
    } catch {
      return;
    }

    // Check auth response
    if (parsed.id === 1) {
      if (parsed.result?.status === "ok" || parsed.result === true) {
        this.paradexWsAuthed = true;
        // Subscribe to private channels
        this.paradexWs?.send(JSON.stringify({ id: 2, method: "subscribe", params: { channel: "orders" } }));
        this.paradexWs?.send(JSON.stringify({ id: 3, method: "subscribe", params: { channel: "fills" } }));
        this.paradexWs?.send(JSON.stringify({ id: 4, method: "subscribe", params: { channel: "positions" } }));
      }
      return;
    }

    // Handle channel updates
    const channel = parsed.params?.channel;
    const updateData = parsed.params?.data;

    if (!channel || !updateData) return;

    const subscribers = this.ctx.storage.sql.exec<SubscriberRow>("SELECT hub_id FROM subscribers").toArray();
    if (subscribers.length === 0) return;

    const accountMsg: AccountUpdateMessage & { channelKey: string } = {
      type: "account",
      userId: this.userId,
      timestamp: Date.now(),
      channelKey: `account:${this.userId}`,
    };

    if (channel === "orders") {
      const order: OrderUpdate = {
        id: updateData.id || updateData.client_id,
        market: updateData.market,
        side: updateData.side?.toLowerCase() === "buy" ? "buy" : "sell",
        type: updateData.type?.toLowerCase() || "limit",
        price: parseFloat(updateData.price || "0"),
        size: parseFloat(updateData.size || "0"),
        filledSize: parseFloat(updateData.size_filled || "0"),
        status: updateData.status || "NEW",
      };
      accountMsg.orders = [order];
    } else if (channel === "positions") {
      const pos: PositionUpdate = {
        id: updateData.market,
        market: updateData.market,
        side: updateData.side?.toLowerCase() === "buy" ? "long" : "short",
        size: Math.abs(parseFloat(updateData.size || "0")),
        entryPrice: parseFloat(updateData.entry_price || "0"),
        markPrice: parseFloat(updateData.mark_price || "0"),
        leverage: parseFloat(updateData.leverage || "1"),
        margin: parseFloat(updateData.margin || "0"),
        pnl: parseFloat(updateData.unrealized_pnl || "0"),
        pnlPercent: parseFloat(updateData.unrealized_pnl_percent || "0"),
      };
      accountMsg.positions = [pos];
    }

    for (const sub of subscribers) {
      try {
        const hubStub = this.env.CLIENT_HUB.get(this.env.CLIENT_HUB.idFromName(sub.hub_id)) as unknown as ClientHubRpc;
        await hubStub.fanout(accountMsg);
      } catch (err) {
        console.warn(`[AccountHub] Failed fanout to ${sub.hub_id}:`, (err as Error).message);
      }
    }
  }
}
