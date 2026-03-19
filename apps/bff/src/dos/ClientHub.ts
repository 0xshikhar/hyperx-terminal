import { DurableObject } from "cloudflare:workers";
import type { ServerMessage } from "@hyperx/types/websocket";
import type { Env, ClientAttachment, ClientHubRpc, MarketRoomRpc, AccountHubRpc } from "../types.js";

export class ClientHub extends DurableObject<Env> implements ClientHubRpc {
  private subs = new Map<string, Set<WebSocket>>();
  private hubId: string = "hub:0";

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.rebuildSubscriptions();
  }

  private rebuildSubscriptions() {
    this.subs.clear();
    const sockets = this.ctx.getWebSockets();
    for (const ws of sockets) {
      try {
        const attachment = ws.deserializeAttachment() as ClientAttachment | null;
        if (attachment?.subs) {
          for (const key of attachment.subs) {
            let set = this.subs.get(key);
            if (!set) {
              set = new Set();
              this.subs.set(key, set);
            }
            set.add(ws);
          }
        }
      } catch {
        // Ignore unparseable attachment
      }
    }
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    const initialAttachment: ClientAttachment = {
      subs: [],
      hubId: this.hubId,
    };

    server.serializeAttachment(initialAttachment);
    this.ctx.acceptWebSocket(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const raw = typeof message === "string" ? message : new TextDecoder().decode(message);
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
      return;
    }

    if (parsed.type === "ping") {
      ws.send(JSON.stringify({ type: "pong", timestamp: parsed.timestamp, serverTime: Date.now() }));
      return;
    }

    if (parsed.type === "auth") {
      // Decode JWT payload without verification or pass through
      try {
        const parts = parsed.token.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          const attachment = (ws.deserializeAttachment() as ClientAttachment) || { subs: [], hubId: this.hubId };
          attachment.userId = payload.userId;
          attachment.tokenVersion = payload.tokenVersion;
          ws.serializeAttachment(attachment);
          ws.send(JSON.stringify({ type: "auth_success", userId: payload.userId }));
        }
      } catch {
        ws.send(JSON.stringify({ type: "auth_error", message: "Invalid token" }));
      }
      return;
    }

    if (parsed.type === "subscribe" || parsed.type === "unsubscribe") {
      const isSub = parsed.type === "subscribe";
      const channels = parsed.channels || [];
      const attachment = (ws.deserializeAttachment() as ClientAttachment) || { subs: [], hubId: this.hubId };

      for (const ch of channels) {
        const network = ch.network || "testnet";
        const key = ch.market ? `${ch.channel}:${ch.market}:${network}` : `${ch.channel}:${network}`;

        if (isSub) {
          if (!attachment.subs.includes(key)) {
            attachment.subs.push(key);
          }
          let set = this.subs.get(key);
          const wasEmpty = !set || set.size === 0;
          if (!set) {
            set = new Set();
            this.subs.set(key, set);
          }
          set.add(ws);

          if (wasEmpty) {
            // Forward room subscribe RPC
            try {
              if (key.startsWith("account:")) {
                const userId = key.slice("account:".length);
                const acctDo = this.env.ACCOUNT_HUB.get(this.env.ACCOUNT_HUB.idFromName(`account:${userId}`)) as unknown as AccountHubRpc;
                await acctDo.subscribe(this.hubId, userId);
              } else {
                const roomDo = this.env.MARKET_ROOM.get(this.env.MARKET_ROOM.idFromName(`market:${network}:${ch.market || "all"}`)) as unknown as MarketRoomRpc;
                const snapshot = await roomDo.subscribe(this.hubId);
                if (snapshot) {
                  ws.send(JSON.stringify(snapshot));
                }
              }
            } catch (err) {
              console.warn(`[ClientHub] Failed to RPC subscribe to room ${key}:`, (err as Error).message);
            }
          }
        } else {
          attachment.subs = attachment.subs.filter((s) => s !== key);
          const set = this.subs.get(key);
          if (set) {
            set.delete(ws);
            if (set.size === 0) {
              this.subs.delete(key);
              try {
                if (key.startsWith("account:")) {
                  const userId = key.slice("account:".length);
                  const acctDo = this.env.ACCOUNT_HUB.get(this.env.ACCOUNT_HUB.idFromName(`account:${userId}`)) as unknown as AccountHubRpc;
                  await acctDo.unsubscribe(this.hubId);
                } else {
                  const roomDo = this.env.MARKET_ROOM.get(this.env.MARKET_ROOM.idFromName(`market:${network}:${ch.market || "all"}`)) as unknown as MarketRoomRpc;
                  await roomDo.unsubscribe(this.hubId);
                }
              } catch {}
            }
          }
        }
      }

      ws.serializeAttachment(attachment);
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    try {
      const attachment = ws.deserializeAttachment() as ClientAttachment | null;
      if (attachment?.subs) {
        for (const key of attachment.subs) {
          const set = this.subs.get(key);
          if (set) {
            set.delete(ws);
            if (set.size === 0) {
              this.subs.delete(key);
            }
          }
        }
      }
    } catch {}
  }

  async fanout(msg: ServerMessage & { channelKey: string }): Promise<void> {
    const sockets = this.subs.get(msg.channelKey);
    if (!sockets || sockets.size === 0) return;

    const payload = JSON.stringify(msg);
    for (const ws of sockets) {
      try {
        ws.send(payload);
      } catch {}
    }
  }

  async requestParadexRefresh(userId: string): Promise<void> {
    const sockets = this.ctx.getWebSockets();
    for (const ws of sockets) {
      try {
        const attachment = ws.deserializeAttachment() as ClientAttachment | null;
        if (attachment?.userId === userId) {
          ws.send(JSON.stringify({ type: "paradex_jwt_refresh" }));
        }
      } catch {}
    }
  }

  async dropAccount(userId: string): Promise<void> {
    const sockets = this.ctx.getWebSockets();
    for (const ws of sockets) {
      try {
        const attachment = ws.deserializeAttachment() as ClientAttachment | null;
        if (attachment?.userId === userId) {
          attachment.userId = undefined;
          attachment.subs = attachment.subs.filter((k) => !k.startsWith("account:"));
          ws.serializeAttachment(attachment);
        }
      } catch {}
    }
    this.rebuildSubscriptions();
  }
}
