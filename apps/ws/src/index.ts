import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { z } from "zod";
import type { ServerMessage } from "@hyperx/types/websocket";
import type { ParadexNetwork } from "@hyperx/types/common";
import { getSubscriptionManager } from "./SubscriptionManager.js";
import { getMessageDispatcher } from "./MessageDispatcher.js";
import { authenticateConnection, requiresAuth, validateAccountChannel } from "./auth.js";
import { initRedisPubSub, onPubSubMessage, isPubSubEnabled, startRedisSubscriber } from "./pubsub";
import { initParadexWsBridge } from "./paradexWs.js";

const PORT = Number(process.env.PORT ?? 3002);

const result = initRedisPubSub();
if (result.enabled) {
  startRedisSubscriber();
}

const subscriptionManager = getSubscriptionManager();
const messageDispatcher = getMessageDispatcher();

const bridges = new Map<ParadexNetwork, ReturnType<typeof initParadexWsBridge> | null>();
const paradexWsEnabled = process.env.PARADEX_WS_ENABLED?.toLowerCase() !== "false";

const wsUrls: Record<ParadexNetwork, string> = {
  testnet: process.env.PARADEX_WS_URL || "wss://ws.api.testnet.paradex.trade/v1",
  mainnet: process.env.PARADEX_MAINNET_WS_URL || "wss://ws.api.prod.paradex.trade/v1",
};

for (const network of ["testnet", "mainnet"] as ParadexNetwork[]) {
  if (!paradexWsEnabled) {
    bridges.set(network, null);
    continue;
  }

  try {
    const bridge = initParadexWsBridge({
      wsUrl: wsUrls[network],
      jwtToken: process.env.PARADEX_JWT_TOKEN,
      onStatus: (status) => {
        messageDispatcher.dispatch({
          channel: "status",
          data: {
            type: "status",
            network,
            networkStatus: status,
            timestamp: Date.now(),
          } as ServerMessage,
        });
      },
    });
    bridges.set(network, bridge);
  } catch (error) {
    console.error(`Failed to initialize Paradex WS bridge for ${network}:`, error);
    bridges.set(network, null);
  }
}

const subscribeSchema = z.object({
  type: z.union([z.literal("subscribe"), z.literal("unsubscribe")]),
  channels: z.array(
    z.object({
      channel: z.union([
        z.literal("ticker"),
        z.literal("orderbook"),
        z.literal("trades"),
        z.literal("status"),
        z.literal("candles"),
        z.string().regex(/^account:.+/),
      ]),
      market: z.string().optional(),
      network: z.enum(["testnet", "mainnet"]).optional().default("testnet"),
    })
  ),
});

const pingSchema = z.object({
  type: z.literal("ping"),
  timestamp: z.number(),
});

const authSchema = z.object({
  type: z.literal("auth"),
  token: z.string(),
});

function channelKey(channel: string, market?: string) {
  return market ? `${channel}:${market}` : channel;
}

const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  if (req.url === "/health") {
    const metrics = subscriptionManager.getMetrics();
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      ok: true,
      clients: metrics.totalClients,
      subscriptions: metrics.totalSubscriptions
    }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server: httpServer });

if (isPubSubEnabled()) {
  onPubSubMessage((message) => {
    messageDispatcher.handlePubSubMessage(message as { channel: string; market?: string; data: ServerMessage });
  });
}

wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
  const id = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const authResult = authenticateConnection(req.url, req.headers.cookie);
  const userId = authResult?.userId;
  const client = subscriptionManager.registerClient(id, ws, userId);

  ws.send(JSON.stringify({
    type: "connected",
    clientId: id,
    authenticated: !!userId,
    userId: userId || undefined,
    timestamp: Date.now(),
  }));

  ws.on("message", (data: Buffer) => {
    const raw = data.toString();
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
      return;
    }

    const ping = pingSchema.safeParse(parsed);
    if (ping.success) {
      subscriptionManager.updatePing(id);
      ws.send(JSON.stringify({
        type: "pong",
        timestamp: ping.data.timestamp,
        serverTime: Date.now()
      }));
      return;
    }

    const auth = authSchema.safeParse(parsed);
    if (auth.success) {
      const authResult = authenticateConnection(undefined, `token=${auth.data.token}`);
      if (authResult) {
        subscriptionManager.setClientAuth(id, authResult.userId);
        ws.send(JSON.stringify({
          type: "auth_success",
          userId: authResult.userId
        }));
      } else {
        ws.send(JSON.stringify({
          type: "auth_error",
          message: "Invalid token"
        }));
      }
      return;
    }

    const sub = subscribeSchema.safeParse(parsed);
    if (!sub.success) {
      ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
      return;
    }

    for (const channelInfo of sub.data.channels) {
      const key = channelKey(channelInfo.channel, channelInfo.market);

      if (requiresAuth(key)) {
        if (!client.userId) {
          ws.send(JSON.stringify({
            type: "error",
            message: `Authentication required for channel: ${key}`
          }));
          continue;
        }

        if (!validateAccountChannel(key, client.userId)) {
          ws.send(JSON.stringify({
            type: "error",
            message: "Access denied to this account channel"
          }));
          continue;
        }
      }

      const bridgeNetwork = channelInfo.network ?? "testnet";
      const bridge = bridges.get(bridgeNetwork);

      if (sub.data.type === "subscribe") {
        const success = subscriptionManager.subscribe(id, key, requiresAuth(key));
        if (success) {
          if (
            bridge &&
            (channelInfo.channel === "ticker" ||
              channelInfo.channel === "orderbook" ||
              channelInfo.channel === "trades")
          ) {
            bridge.subscribe(channelInfo.channel, channelInfo.market);
          }
          ws.send(JSON.stringify({
            type: "subscribed",
            channel: key,
            network: bridgeNetwork,
          }));
        } else {
          ws.send(JSON.stringify({
            type: "error",
            message: `Failed to subscribe to ${key}`
          }));
        }
      } else {
        subscriptionManager.unsubscribe(id, key);
        if (
          bridge &&
          (channelInfo.channel === "ticker" ||
            channelInfo.channel === "orderbook" ||
            channelInfo.channel === "trades")
        ) {
          bridge.unsubscribe(channelInfo.channel, channelInfo.market);
        }
        ws.send(JSON.stringify({
          type: "unsubscribed",
          channel: key,
          network: bridgeNetwork,
        }));
      }
    }
  });

  ws.on("close", () => {
    for (const subKey of client.subscriptions) {
      const [channel, market] = subKey.split(":");
      for (const bridge of bridges.values()) {
        if (bridge && (channel === "ticker" || channel === "orderbook" || channel === "trades")) {
          bridge.unsubscribe(channel as "ticker" | "orderbook" | "trades", market);
        }
      }
    }
    subscriptionManager.removeClient(id);
  });

  ws.on("error", () => {
    for (const subKey of client.subscriptions) {
      const [channel, market] = subKey.split(":");
      for (const bridge of bridges.values()) {
        if (bridge && (channel === "ticker" || channel === "orderbook" || channel === "trades")) {
          bridge.unsubscribe(channel as "ticker" | "orderbook" | "trades", market);
        }
      }
    }
    subscriptionManager.removeClient(id);
  });
});

const HEARTBEAT_INTERVAL = 30000;
const PING_INTERVAL = 15000;

setInterval(() => {
  const stale = subscriptionManager.cleanupStaleClients(HEARTBEAT_INTERVAL);
  if (stale.length > 0) {
    console.log(`Cleaned up ${stale.length} stale clients`);
  }
}, PING_INTERVAL);

setInterval(() => {
  messageDispatcher.dispatch({
    channel: "status",
    data: {
      type: "status",
      network: "testnet",
      networkStatus: bridges.get("testnet")?.getStatus() ?? "down",
      timestamp: Date.now(),
    } as ServerMessage,
  });
  messageDispatcher.dispatch({
    channel: "status",
    data: {
      type: "status",
      network: "mainnet",
      networkStatus: bridges.get("mainnet")?.getStatus() ?? "down",
      timestamp: Date.now(),
    } as ServerMessage,
  });
}, 5000);

httpServer.listen(PORT, () => {
  console.log(`WS server running on port ${PORT}`);
});
