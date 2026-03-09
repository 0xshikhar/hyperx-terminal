import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { z } from "zod";
import { getSubscriptionManager } from "./SubscriptionManager.js";
import { getMessageDispatcher } from "./MessageDispatcher.js";
import { authenticateConnection, requiresAuth, validateAccountChannel } from "./auth.js";
import { initRedisPubSub, onPubSubMessage, isPubSubEnabled, startRedisSubscriber } from "./pubsub";
import { initParadexWsBridge } from "./paradexWs.js";
const PORT = Number(process.env.PORT ?? 3002);
// Initialize Redis Pub/Sub
const result = initRedisPubSub();
if (result.enabled) {
    startRedisSubscriber();
}
// Initialize subscription manager and message dispatcher
const subscriptionManager = getSubscriptionManager();
const messageDispatcher = getMessageDispatcher();
const paradexWsEnabled = process.env.PARADEX_WS_ENABLED?.toLowerCase() !== "false";
const paradexWsUrl = process.env.PARADEX_WS_URL ||
    (process.env.NODE_ENV === "production"
        ? "wss://ws.api.prod.paradex.trade/v1"
        : "wss://ws.api.testnet.paradex.trade/v1");
const paradexBridge = paradexWsEnabled
    ? initParadexWsBridge({
        wsUrl: paradexWsUrl,
        jwtToken: process.env.PARADEX_JWT_TOKEN,
        onStatus: (status) => {
            messageDispatcher.dispatch({
                channel: "status",
                data: {
                    type: "status",
                    networkStatus: status,
                    timestamp: Date.now(),
                },
            });
        },
    })
    : null;
// Message schemas
const subscribeSchema = z.object({
    type: z.union([z.literal("subscribe"), z.literal("unsubscribe")]),
    channels: z.array(z.object({
        channel: z.union([
            z.literal("ticker"),
            z.literal("orderbook"),
            z.literal("trades"),
            z.literal("status"),
            z.literal("candles"),
            z.string().regex(/^account:.+/), // account:{userId} format
        ]),
        market: z.string().optional(),
    })),
});
const pingSchema = z.object({
    type: z.literal("ping"),
    timestamp: z.number(),
});
const authSchema = z.object({
    type: z.literal("auth"),
    token: z.string(),
});
// Helper functions
function channelKey(channel, market) {
    return market ? `${channel}:${market}` : channel;
}
function randomBetween(min, max) {
    return min + Math.random() * (max - min);
}
// HTTP health check server
const httpServer = createServer((req, res) => {
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
// WebSocket server
const wss = new WebSocketServer({ server: httpServer });
// Handle Redis pub/sub messages
if (isPubSubEnabled()) {
    onPubSubMessage((message) => {
        messageDispatcher.handlePubSubMessage(message);
    });
}
// WebSocket connection handler
wss.on("connection", (ws, req) => {
    const id = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    // Try to authenticate on connection
    const authResult = authenticateConnection(req.url, req.headers.cookie);
    const userId = authResult?.userId;
    // Register client with subscription manager
    const client = subscriptionManager.registerClient(id, ws, userId);
    // Send welcome message
    ws.send(JSON.stringify({
        type: "connected",
        clientId: id,
        authenticated: !!userId,
        userId: userId || undefined,
        timestamp: Date.now(),
    }));
    // Handle messages
    ws.on("message", (data) => {
        const raw = data.toString();
        let parsed;
        try {
            parsed = JSON.parse(raw);
        }
        catch {
            ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
            return;
        }
        // Handle ping
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
        // Handle auth message
        const auth = authSchema.safeParse(parsed);
        if (auth.success) {
            const authResult = authenticateConnection(undefined, `token=${auth.data.token}`);
            if (authResult) {
                subscriptionManager.setClientAuth(id, authResult.userId);
                ws.send(JSON.stringify({
                    type: "auth_success",
                    userId: authResult.userId
                }));
            }
            else {
                ws.send(JSON.stringify({
                    type: "auth_error",
                    message: "Invalid token"
                }));
            }
            return;
        }
        // Handle subscribe/unsubscribe
        const sub = subscribeSchema.safeParse(parsed);
        if (!sub.success) {
            ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
            return;
        }
        for (const channelInfo of sub.data.channels) {
            const key = channelKey(channelInfo.channel, channelInfo.market);
            // Check if channel requires authentication
            if (requiresAuth(key)) {
                if (!client.userId) {
                    ws.send(JSON.stringify({
                        type: "error",
                        message: `Authentication required for channel: ${key}`
                    }));
                    continue;
                }
                // Validate account channel access
                if (!validateAccountChannel(key, client.userId)) {
                    ws.send(JSON.stringify({
                        type: "error",
                        message: "Access denied to this account channel"
                    }));
                    continue;
                }
            }
            if (sub.data.type === "subscribe") {
                const success = subscriptionManager.subscribe(id, key, requiresAuth(key));
                if (success) {
                    if (paradexBridge &&
                        (channelInfo.channel === "ticker" ||
                            channelInfo.channel === "orderbook" ||
                            channelInfo.channel === "trades")) {
                        paradexBridge.subscribe(channelInfo.channel, channelInfo.market);
                    }
                    ws.send(JSON.stringify({
                        type: "subscribed",
                        channel: key
                    }));
                }
                else {
                    ws.send(JSON.stringify({
                        type: "error",
                        message: `Failed to subscribe to ${key}`
                    }));
                }
            }
            else {
                subscriptionManager.unsubscribe(id, key);
                if (paradexBridge &&
                    (channelInfo.channel === "ticker" ||
                        channelInfo.channel === "orderbook" ||
                        channelInfo.channel === "trades")) {
                    paradexBridge.unsubscribe(channelInfo.channel, channelInfo.market);
                }
                ws.send(JSON.stringify({
                    type: "unsubscribed",
                    channel: key
                }));
            }
        }
    });
    ws.on("close", () => {
        if (paradexBridge) {
            for (const subKey of client.subscriptions) {
                const [channel, market] = subKey.split(":");
                if (channel === "ticker" || channel === "orderbook" || channel === "trades") {
                    paradexBridge.unsubscribe(channel, market);
                }
            }
        }
        subscriptionManager.removeClient(id);
    });
    ws.on("error", () => {
        if (paradexBridge) {
            for (const subKey of client.subscriptions) {
                const [channel, market] = subKey.split(":");
                if (channel === "ticker" || channel === "orderbook" || channel === "trades") {
                    paradexBridge.unsubscribe(channel, market);
                }
            }
        }
        subscriptionManager.removeClient(id);
    });
});
// Heartbeat and cleanup intervals
const HEARTBEAT_INTERVAL = 30000;
const PING_INTERVAL = 15000;
setInterval(() => {
    const stale = subscriptionManager.cleanupStaleClients(HEARTBEAT_INTERVAL);
    if (stale.length > 0) {
        console.log(`Cleaned up ${stale.length} stale clients`);
    }
}, PING_INTERVAL);
// Data publishers
function publishTicker(market) {
    const base = market === "ETH-USD" ? 4800 : market === "STRK-USD" ? 2.2 : 95000;
    const lastPrice = base + randomBetween(-1, 1) * (market === "STRK-USD" ? 0.02 : 120);
    messageDispatcher.dispatch({
        channel: "ticker",
        market,
        data: {
            type: "ticker",
            market,
            lastPrice,
            changePercent24h: randomBetween(-5, 5),
            volume24h: randomBetween(10_000_000, 1_200_000_000),
            openInterest: randomBetween(1_000_000, 800_000_000),
            fundingRate: randomBetween(-0.03, 0.03),
            timestamp: Date.now(),
        },
    });
}
function publishOrderbook(market) {
    const base = market === "ETH-USD" ? 4800 : market === "STRK-USD" ? 2.2 : 95000;
    const mid = base + randomBetween(-1, 1) * (market === "STRK-USD" ? 0.02 : 80);
    const tick = market === "STRK-USD" ? 0.001 : market === "ETH-USD" ? 0.5 : 5;
    const bids = Array.from({ length: 30 }).map((_, i) => ({
        price: Math.round((mid - i * tick) / tick) * tick,
        size: randomBetween(0.01, 5) * (1 + i / 10),
    }));
    const asks = Array.from({ length: 30 }).map((_, i) => ({
        price: Math.round((mid + i * tick) / tick) * tick,
        size: randomBetween(0.01, 5) * (1 + i / 10),
    }));
    messageDispatcher.dispatch({
        channel: "orderbook",
        market,
        data: {
            type: "orderbook",
            market,
            bids,
            asks,
            timestamp: Date.now(),
        },
    });
}
function publishTrades(market) {
    const base = market === "ETH-USD" ? 4800 : market === "STRK-USD" ? 2.2 : 95000;
    const price = base + randomBetween(-1, 1) * (market === "STRK-USD" ? 0.02 : 80);
    messageDispatcher.dispatch({
        channel: "trades",
        market,
        data: {
            type: "trades",
            market,
            trades: [
                {
                    id: `${market}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
                    side: Math.random() > 0.5 ? "buy" : "sell",
                    price,
                    size: randomBetween(0.01, 2),
                    timestamp: Date.now(),
                },
            ],
            timestamp: Date.now(),
        },
    });
}
function publishStatus() {
    messageDispatcher.dispatch({
        channel: "status",
        data: {
            type: "status",
            blockHeight: Math.floor(randomBetween(1_200_000, 2_100_000)),
            gasPrice: randomBetween(5, 80).toFixed(2),
            timestamp: Date.now(),
        },
    });
}
// Mock account data publisher (for auth-gated channels)
function publishAccountUpdates() {
    const metrics = subscriptionManager.getMetrics();
    // Publish to each authenticated user's account channel
    for (const [channel, count] of metrics.channels.entries()) {
        if (channel.startsWith("account:")) {
            const userId = channel.split(":")[1];
            messageDispatcher.dispatchToUser(userId, {
                type: "account",
                userId,
                balance: 10000 + randomBetween(-1000, 1000),
                marginUsed: randomBetween(1000, 5000),
                unrealizedPnl: randomBetween(-500, 500),
                timestamp: Date.now(),
            });
        }
    }
}
const useMockStreams = !paradexBridge;
const markets = ["BTC-USD", "ETH-USD", "STRK-USD"];
if (useMockStreams) {
    setInterval(() => {
        for (const market of markets) {
            publishTicker(market);
            publishOrderbook(market);
            publishTrades(market);
        }
        publishStatus();
    }, 500);
}
else {
    setInterval(() => {
        messageDispatcher.dispatch({
            channel: "status",
            data: {
                type: "status",
                networkStatus: paradexBridge?.getStatus() ?? "down",
                timestamp: Date.now(),
            },
        });
    }, 5000);
}
// Publish account updates (every 2 seconds)
setInterval(() => {
    publishAccountUpdates();
}, 2000);
httpServer.listen(PORT, () => {
    console.log(`WS server running on port ${PORT}`);
});
