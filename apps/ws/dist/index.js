import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { z } from "zod";
const PORT = Number(process.env.PORT ?? 3002);
const subscribeSchema = z.object({
    type: z.union([z.literal("subscribe"), z.literal("unsubscribe")]),
    channels: z.array(z.object({
        channel: z.union([
            z.literal("ticker"),
            z.literal("orderbook"),
            z.literal("trades"),
            z.literal("status"),
        ]),
        market: z.string().optional(),
    })),
});
const pingSchema = z.object({
    type: z.literal("ping"),
    timestamp: z.number(),
});
function channelKey(channel, market) {
    return market ? `${channel}:${market}` : channel;
}
function randomBetween(min, max) {
    return min + Math.random() * (max - min);
}
const httpServer = createServer((req, res) => {
    if (req.url === "/health") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        return;
    }
    res.writeHead(404);
    res.end();
});
const wss = new WebSocketServer({ server: httpServer });
const clients = new Map();
function broadcast(key, payload) {
    const message = JSON.stringify(payload);
    for (const { ws, state } of clients.values()) {
        if (!state.subscriptions.has(key))
            continue;
        if (ws.readyState !== ws.OPEN)
            continue;
        ws.send(message);
    }
}
function publishTicker(market) {
    const base = market === "ETH-USD" ? 4800 : market === "STRK-USD" ? 2.2 : 95000;
    const lastPrice = base + randomBetween(-1, 1) * (market === "STRK-USD" ? 0.02 : 120);
    broadcast(channelKey("ticker", market), {
        type: "ticker",
        market,
        lastPrice,
        changePercent24h: randomBetween(-5, 5),
        volume24h: randomBetween(10_000_000, 1_200_000_000),
        openInterest: randomBetween(1_000_000, 800_000_000),
        fundingRate: randomBetween(-0.03, 0.03),
        timestamp: Date.now(),
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
    broadcast(channelKey("orderbook", market), {
        type: "orderbook",
        market,
        bids,
        asks,
        timestamp: Date.now(),
    });
}
function publishTrades(market) {
    const base = market === "ETH-USD" ? 4800 : market === "STRK-USD" ? 2.2 : 95000;
    const price = base + randomBetween(-1, 1) * (market === "STRK-USD" ? 0.02 : 80);
    broadcast(channelKey("trades", market), {
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
    });
}
function publishStatus() {
    broadcast("status", {
        type: "status",
        blockHeight: Math.floor(randomBetween(1_200_000, 2_100_000)),
        gasPrice: randomBetween(5, 80).toFixed(2),
        timestamp: Date.now(),
    });
}
wss.on("connection", (ws) => {
    const id = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const state = { id, subscriptions: new Set() };
    clients.set(id, { ws, state });
    ws.on("message", (data) => {
        const raw = data.toString();
        let parsed;
        try {
            parsed = JSON.parse(raw);
        }
        catch {
            return;
        }
        const ping = pingSchema.safeParse(parsed);
        if (ping.success) {
            ws.send(JSON.stringify({ type: "pong", timestamp: ping.data.timestamp }));
            return;
        }
        const sub = subscribeSchema.safeParse(parsed);
        if (!sub.success)
            return;
        for (const channel of sub.data.channels) {
            const key = channelKey(channel.channel, channel.market);
            if (sub.data.type === "subscribe") {
                state.subscriptions.add(key);
            }
            else {
                state.subscriptions.delete(key);
            }
        }
    });
    ws.on("close", () => {
        clients.delete(id);
    });
});
httpServer.listen(PORT);
const markets = ["BTC-USD", "ETH-USD", "STRK-USD"];
setInterval(() => {
    for (const market of markets) {
        publishTicker(market);
        publishOrderbook(market);
        publishTrades(market);
    }
    publishStatus();
}, 500);
