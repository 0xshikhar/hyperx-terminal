import WebSocket from "ws";
import type { ServerMessage } from "@hyperx/types/websocket";
import { getMessageDispatcher } from "./MessageDispatcher.js";

type BridgeStatus = "healthy" | "down";
type BridgeChannel = "ticker" | "orderbook" | "trades";

type InitOptions = {
  wsUrl: string;
  jwtToken?: string;
  onStatus?: (status: BridgeStatus) => void;
};

type OrderbookSide = "bid" | "ask";

type OrderbookState = {
  bids: Map<string, number>;
  asks: Map<string, number>;
};

const ORDERBOOK_FEED = "snapshot";
const ORDERBOOK_DEPTH = "15";
const ORDERBOOK_REFRESH = "100ms";

function toParadexMarket(market: string): string {
  return market.toUpperCase().includes("-PERP") ? market : `${market}-PERP`;
}

function fromParadexMarket(market: string): string {
  return market.replace(/-PERP$/i, "");
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export function initParadexWsBridge(options: InitOptions) {
  const messageDispatcher = getMessageDispatcher();
  const wsUrl = options.wsUrl;
  const jwtToken = options.jwtToken;
  let ws: WebSocket | null = null;
  let status: BridgeStatus = "down";
  let reconnectTimer: NodeJS.Timeout | null = null;
  let nextId = 1;
  let isOpen = false;

  const subscriptionCounts = new Map<string, number>();
  const orderbookState = new Map<string, OrderbookState>();
  let tickerSubscribed = false;

  const setStatus = (next: BridgeStatus) => {
    if (status !== next) {
      status = next;
      options.onStatus?.(status);
    }
  };

  const send = (payload: Record<string, unknown>) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(payload));
  };

  const subscribeParadexChannel = (channel: string) => {
    send({
      id: nextId++,
      jsonrpc: "2.0",
      method: "subscribe",
      params: { channel },
    });
  };

  const unsubscribeParadexChannel = (channel: string) => {
    send({
      id: nextId++,
      jsonrpc: "2.0",
      method: "unsubscribe",
      params: { channel },
    });
  };

  const resubscribeAll = () => {
    if (tickerSubscribed) {
      subscribeParadexChannel("markets_summary");
    }
    for (const key of subscriptionCounts.keys()) {
      subscribeParadexChannel(key);
    }
  };

  const scheduleReconnect = () => {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, 2000);
  };

  const handleMarketsSummary = (data: Record<string, unknown>) => {
    const market = fromParadexMarket(String(data.symbol ?? data.market ?? ""));
    if (!market) return;

    const message: ServerMessage = {
      type: "ticker",
      market,
      lastPrice: toNumber(data.last_traded_price ?? data.last_price),
      changePercent24h: toNumber(
        data.price_change_rate_24h ?? data.change_percent_24h
      ),
      volume24h: toNumber(data.volume_24h ?? data.total_volume),
      openInterest: toNumber(data.open_interest),
      fundingRate: toNumber(data.funding_rate),
      timestamp: Date.now(),
    };

    messageDispatcher.dispatch({ channel: "ticker", market, data: message });
  };

  const getOrderbookState = (market: string) => {
    let state = orderbookState.get(market);
    if (!state) {
      state = { bids: new Map(), asks: new Map() };
      orderbookState.set(market, state);
    }
    return state;
  };

  const applyOrderbookEntries = (
    state: OrderbookState,
    entries: Array<Record<string, unknown>>,
    fallbackSide?: OrderbookSide
  ) => {
    for (const entry of entries) {
      const sideRaw = String(entry.side ?? fallbackSide ?? "").toLowerCase();
      const side = sideRaw === "bid" || sideRaw === "buy" ? "bid" : "ask";
      const price = String(entry.price ?? entry.level ?? "");
      if (!price) continue;
      const size = toNumber(entry.size ?? entry.quantity ?? "0");
      const book = side === "bid" ? state.bids : state.asks;
      if (size <= 0) {
        book.delete(price);
      } else {
        book.set(price, size);
      }
    }
  };

  const handleOrderbook = (channel: string, data: Record<string, unknown>) => {
    const marketRaw = String(data.market ?? "").trim();
    const market = fromParadexMarket(marketRaw || channel.split(".")[1] || "");
    if (!market) return;

    const state = getOrderbookState(market);
    const updateType = String(data.update_type ?? data.updateType ?? "").toLowerCase();
    if (updateType === "s" || updateType === "snapshot") {
      state.bids.clear();
      state.asks.clear();
    }

    applyOrderbookEntries(
      state,
      (data.updates as Array<Record<string, unknown>>) ?? []
    );
    applyOrderbookEntries(
      state,
      (data.inserts as Array<Record<string, unknown>>) ?? []
    );
    applyOrderbookEntries(
      state,
      (data.deletes as Array<Record<string, unknown>>) ?? [],
      undefined
    );

    const bids = Array.from(state.bids.entries())
      .map(([price, size]) => ({ price: Number(price), size }))
      .sort((a, b) => b.price - a.price)
      .slice(0, 30);
    const asks = Array.from(state.asks.entries())
      .map(([price, size]) => ({ price: Number(price), size }))
      .sort((a, b) => a.price - b.price)
      .slice(0, 30);

    const message: ServerMessage = {
      type: "orderbook",
      market,
      bids,
      asks,
      sequence: toNumber(data.seq_no),
      timestamp: Date.now(),
    };

    messageDispatcher.dispatch({ channel: "orderbook", market, data: message });
  };

  const handleTrades = (data: Record<string, unknown>) => {
    const market = fromParadexMarket(String(data.market ?? ""));
    if (!market) return;

    const message: ServerMessage = {
      type: "trades",
      market,
      trades: [
        {
          id: String(data.id ?? `${market}-${Date.now()}`),
          side: String(data.side ?? "BUY").toLowerCase() === "sell" ? "sell" : "buy",
          price: toNumber(data.price),
          size: toNumber(data.size),
          timestamp: toNumber(data.created_at ?? Date.now()),
        },
      ],
      timestamp: Date.now(),
    };

    messageDispatcher.dispatch({ channel: "trades", market, data: message });
  };

  const handleMessage = (raw: string) => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }

    const params = parsed.params as Record<string, unknown> | undefined;
    const channel = typeof params?.channel === "string" ? params.channel : "";
    const data = (params?.data as Record<string, unknown>) ?? {};

    if (!channel) return;

    if (channel.startsWith("markets_summary")) {
      handleMarketsSummary(data);
      return;
    }

    if (channel.startsWith("order_book.")) {
      handleOrderbook(channel, data);
      return;
    }

    if (channel.startsWith("trades.")) {
      handleTrades(data);
    }
  };

  const connect = () => {
    if (ws) {
      ws.removeAllListeners();
      ws.close();
    }

    ws = new WebSocket(wsUrl);

    ws.on("open", () => {
      isOpen = true;
      setStatus("healthy");
      if (jwtToken) {
        send({
          id: nextId++,
          jsonrpc: "2.0",
          method: "auth",
          params: { bearer: jwtToken },
        });
      }
      resubscribeAll();
    });

    ws.on("message", (data) => {
      handleMessage(data.toString());
    });

    ws.on("close", () => {
      isOpen = false;
      setStatus("down");
      scheduleReconnect();
    });

    ws.on("error", () => {
      isOpen = false;
      setStatus("down");
      scheduleReconnect();
    });
  };

  const subscribe = (channel: BridgeChannel, market?: string) => {
    if (channel === "ticker") {
      if (!tickerSubscribed) {
        tickerSubscribed = true;
        if (isOpen) subscribeParadexChannel("markets_summary");
      }
      return;
    }

    if (!market) return;
    const marketSymbol = toParadexMarket(market);
    const channelKey =
      channel === "trades"
        ? `trades.${marketSymbol}`
        : `order_book.${marketSymbol}.${ORDERBOOK_FEED}@${ORDERBOOK_DEPTH}@${ORDERBOOK_REFRESH}`;

    const count = subscriptionCounts.get(channelKey) ?? 0;
    subscriptionCounts.set(channelKey, count + 1);
    if (count === 0 && isOpen) {
      subscribeParadexChannel(channelKey);
    }
  };

  const unsubscribe = (channel: BridgeChannel, market?: string) => {
    if (channel === "ticker") {
      if (tickerSubscribed) {
        tickerSubscribed = false;
        if (isOpen) unsubscribeParadexChannel("markets_summary");
      }
      return;
    }

    if (!market) return;
    const marketSymbol = toParadexMarket(market);
    const channelKey =
      channel === "trades"
        ? `trades.${marketSymbol}`
        : `order_book.${marketSymbol}.${ORDERBOOK_FEED}@${ORDERBOOK_DEPTH}@${ORDERBOOK_REFRESH}`;

    const count = subscriptionCounts.get(channelKey) ?? 0;
    if (count <= 1) {
      subscriptionCounts.delete(channelKey);
      if (isOpen) unsubscribeParadexChannel(channelKey);
    } else {
      subscriptionCounts.set(channelKey, count - 1);
    }
  };

  connect();

  return {
    enabled: true,
    subscribe,
    unsubscribe,
    getStatus: () => status,
  };
}
