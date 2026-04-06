import type {
  CandlesChannel,
  ClientMessage,
  ChannelPayloadMap,
  ServerMessage,
  SubscribableChannel,
  WSChannel,
} from "./channelTypes";
import { parseServerMessage } from "./fastMessageParser";
import { getToken } from "../auth.service";

export type ConnectionState = "connecting" | "connected" | "disconnected" | "error";

export type WSConnectionEvent =
  | { type: "connect_start"; timestamp: number }
  | { type: "open"; timestamp: number }
  | { type: "close"; timestamp: number; code: number; reason: string; willReconnect: boolean }
  | { type: "error"; timestamp: number }
  | { type: "heartbeat"; timestamp: number; rttMs: number }
  | { type: "rate_sample"; timestamp: number; messagesPerSecond: number; byChannel: Record<string, number> }
  | { type: "feed_watchdog"; timestamp: number; action: "resubscribe" }
  | {
      type: "reconnect_scheduled";
      timestamp: number;
      attempt: number;
      delayMs: number;
      reconnectAt: number;
    }
  | { type: "manual_disconnect"; timestamp: number };

type Listener<T> = { bivarianceHack(payload: T): void }["bivarianceHack"];

type WSClientOptions = {
  url: string;
  reconnect?: boolean;
  reconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
  /**
   * App-level ping interval (default 5000ms). A missed pong within
   * `pongTimeoutMs` declares the socket a zombie and forces the reconnect
   * cycle — TCP can stay OPEN while the server is dead. Pass 0 to disable.
   */
  heartbeatIntervalMs?: number;
  /** Max wait for a pong reply before closing the socket (default 3000ms). */
  pongTimeoutMs?: number;
  /**
   * If subscriptions exist but no feed traffic arrives for this long while
   * heartbeats still succeed, the server-side feed is presumed dead and all
   * subscriptions are re-sent (default 45000ms). Pass 0 to disable.
   */
  feedSilenceMs?: number;
  /** Throughput sampling window for rate_sample events (default 1000ms). */
  rateSampleMs?: number;
};

export class WSClient {
  private url: string;
  private reconnect: boolean;
  private reconnectDelayMs: number;
  private maxReconnectDelayMs: number;
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimeout: number | null = null;
  private state: ConnectionState = "disconnected";
  private shouldReconnect = true;
  private readonly heartbeatIntervalMs: number;
  private readonly pongTimeoutMs: number;
  private readonly feedSilenceMs: number;
  private readonly rateSampleMs: number;
  private heartbeatTimer: number | null = null;
  private pongTimer: number | null = null;
  private rateTimer: number | null = null;
  private lastPingSentAt = 0;
  private lastMessageAt = 0;
  private lastFeedMessageAt = 0;
  private msgWindowCount = 0;
  private msgWindowByChannel = new Map<WSChannel | string, number>();
  private stateListeners = new Set<Listener<ConnectionState>>();
  private connectionEventListeners = new Set<Listener<WSConnectionEvent>>();
  private activeSubscriptions = new Map<
    string,
    {
      channel: SubscribableChannel | CandlesChannel;
      market?: string;
      count: number;
    }
  >();

  private channelListeners = new Map<WSChannel, Set<Listener<ServerMessage>>>();

  constructor(options: WSClientOptions) {
    this.url = options.url;
    this.reconnect = options.reconnect ?? true;
    this.reconnectDelayMs = options.reconnectDelayMs ?? 1000;
    this.maxReconnectDelayMs = options.maxReconnectDelayMs ?? 30000;
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 5000;
    this.pongTimeoutMs = options.pongTimeoutMs ?? 3000;
    this.feedSilenceMs = options.feedSilenceMs ?? 45000;
    this.rateSampleMs = options.rateSampleMs ?? 1000;
  }

  get connectionState() {
    return this.state;
  }

  /** Wall-clock time of the last inbound frame (any type). */
  get lastInboundAt() {
    return this.lastMessageAt;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.shouldReconnect = true;
    this.setState("connecting");
    this.emitConnectionEvent({ type: "connect_start", timestamp: Date.now() });
    
    const token = getToken();
    const ws = new WebSocket(this.url);

    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.reconnectAttempts = 0;
      this.setState("connected");
      this.emitConnectionEvent({ type: "open", timestamp: Date.now() });
      this.lastMessageAt = Date.now();
      this.lastFeedMessageAt = Date.now();
      if (token) {
        ws.send(JSON.stringify({ type: "auth", token }));
      }
      this.resubscribeAll();
      this.startHeartbeat();
      this.startRateSampler();
    };

    ws.onmessage = (event) => {
      if (this.ws !== ws) return;
      if (typeof event.data !== "string") {
        // Server is JSON-only today; surface binary drops in rate_sample telemetry
        // under a dedicated bucket instead of silently swallowing them.
        this.msgWindowByChannel.set(
          "binary_dropped",
          (this.msgWindowByChannel.get("binary_dropped") ?? 0) + 1
        );
        return;
      }
      const parsed = parseServerMessage(event.data);
      if (parsed) {
        const now = Date.now();
        this.lastMessageAt = now;
        this.msgWindowCount += 1;
        this.msgWindowByChannel.set(
          parsed.type,
          (this.msgWindowByChannel.get(parsed.type) ?? 0) + 1
        );
        if (parsed.type === "pong") {
          this.handlePong();
        } else if (parsed.type !== "status") {
          this.lastFeedMessageAt = now;
        }
        this.dispatch(parsed);
      }
    };

    ws.onclose = (event) => {
      if (this.ws === ws) {
        this.ws = null;
      }
      this.stopHeartbeat();
      this.stopRateSampler();
      this.setState("disconnected");
      const willReconnect = this.reconnect && this.shouldReconnect;
      this.emitConnectionEvent({
        type: "close",
        timestamp: Date.now(),
        code: event.code,
        reason: event.reason,
        willReconnect,
      });
      if (!willReconnect) return;
      this.scheduleReconnect();
    };

    ws.onerror = () => {
      if (this.ws !== ws) return;
      this.setState("error");
      this.emitConnectionEvent({ type: "error", timestamp: Date.now() });
    };

    this.ws = ws;
  }

  disconnect() {
    this.shouldReconnect = false;
    this.stopHeartbeat();
    this.stopRateSampler();
    if (this.reconnectTimeout) {
      window.clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.ws?.close();
    this.ws = null;
    this.setState("disconnected");
    this.emitConnectionEvent({ type: "manual_disconnect", timestamp: Date.now() });
  }

  /**
   * Force a reconnect cycle now (e.g. the tab regained focus and feeds are
   * stale). Unlike disconnect(), this keeps auto-reconnect armed.
   */
  reconnectNow() {
    this.shouldReconnect = true;
    if (this.ws) {
      this.ws.close(4000, "client resync");
    } else if (this.state !== "connecting") {
      this.connect();
    }
  }

  send(message: ClientMessage) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(message));
  }

  subscribe(channel: SubscribableChannel | CandlesChannel, market?: string, network?: "testnet" | "mainnet") {
    const key = this.subscriptionKey(channel, market);
    const existing = this.activeSubscriptions.get(key);
    if (existing) {
      existing.count += 1;
      return;
    }

    this.activeSubscriptions.set(key, { channel, market, count: 1 });
    this.sendSubscription("subscribe", channel, market, network);
  }

  unsubscribe(channel: SubscribableChannel | CandlesChannel, market?: string, network?: "testnet" | "mainnet") {
    const key = this.subscriptionKey(channel, market);
    const existing = this.activeSubscriptions.get(key);
    if (!existing) return;

    if (existing.count > 1) {
      existing.count -= 1;
      return;
    }

    this.activeSubscriptions.delete(key);
    this.sendSubscription("unsubscribe", channel, market, network);
  }

  onStateChange(listener: Listener<ConnectionState>) {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  onConnectionEvent(listener: Listener<WSConnectionEvent>) {
    this.connectionEventListeners.add(listener);
    return () => this.connectionEventListeners.delete(listener);
  }

  on<T extends WSChannel>(channel: T, listener: Listener<ChannelPayloadMap[T]>) {
    const set = this.channelListeners.get(channel as WSChannel) ?? new Set();
    set.add(listener as Listener<ServerMessage>);
    this.channelListeners.set(channel as WSChannel, set);
    return () => {
      const current = this.channelListeners.get(channel as WSChannel);
      current?.delete(listener as Listener<ServerMessage>);
    };
  }

  ping() {
    this.lastPingSentAt = performance.now();
    this.send({ type: "ping", timestamp: this.lastPingSentAt });
  }

  private setState(state: ConnectionState) {
    if (this.state === state) return;
    this.state = state;
    for (const listener of this.stateListeners) listener(state);
  }

  private dispatch(message: ServerMessage) {
    const listeners = this.channelListeners.get(message.type as WSChannel);
    if (!listeners) return;
    for (const listener of listeners) {
      listener(message);
    }
  }

  private emitConnectionEvent(event: WSConnectionEvent) {
    for (const listener of this.connectionEventListeners) {
      listener(event);
    }
  }

  private sendSubscription(
    type: "subscribe" | "unsubscribe",
    channel: SubscribableChannel | CandlesChannel,
    market?: string,
    network?: "testnet" | "mainnet"
  ) {
    const usesRawChannel = typeof channel === "string" && channel.startsWith("candles:");
    this.send({
      type,
      channels: [usesRawChannel ? { channel } : { channel, market, network }],
    });
  }

  private subscriptionKey(channel: SubscribableChannel | CandlesChannel, market?: string) {
    return `${channel}::${market ?? "*"}`;
  }

  private resubscribeAll() {
    for (const subscription of this.activeSubscriptions.values()) {
      this.sendSubscription("subscribe", subscription.channel, subscription.market);
    }
  }

  /**
   * App-level heartbeat owned by the client so it survives route changes and
   * does not depend on any mounted component. A missed pong means the socket
   * is a zombie (TCP OPEN, server dead) → close and let the reconnect cycle
   * take over.
   */
  private startHeartbeat() {
    if (this.heartbeatIntervalMs <= 0) return;
    this.stopHeartbeat();
    this.heartbeatTimer = window.setInterval(() => this.heartbeatTick(), this.heartbeatIntervalMs);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.pongTimer) {
      window.clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  private heartbeatTick() {
    if (this.state !== "connected" || this.ws?.readyState !== WebSocket.OPEN) return;

    // Feed watchdog: heartbeats succeed but subscribed feeds went silent —
    // resubscribe rather than sit on a dead feed.
    if (
      this.feedSilenceMs > 0 &&
      this.activeSubscriptions.size > 0 &&
      Date.now() - this.lastFeedMessageAt > this.feedSilenceMs
    ) {
      this.emitConnectionEvent({
        type: "feed_watchdog",
        timestamp: Date.now(),
        action: "resubscribe",
      });
      this.resubscribeAll();
      this.lastFeedMessageAt = Date.now();
    }

    if (this.pongTimer) return; // previous ping still in flight
    this.ping();
    this.pongTimer = window.setTimeout(() => {
      this.pongTimer = null;
      this.ws?.close(4000, "heartbeat timeout");
    }, this.pongTimeoutMs);
  }

  private handlePong() {
    if (this.pongTimer) {
      window.clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
    const rttMs = this.lastPingSentAt > 0 ? performance.now() - this.lastPingSentAt : 0;
    this.emitConnectionEvent({ type: "heartbeat", timestamp: Date.now(), rttMs });
  }

  /** Samples inbound message throughput; emits rate_sample every window. */
  private startRateSampler() {
    if (this.rateSampleMs <= 0) return;
    this.stopRateSampler();
    this.msgWindowCount = 0;
    this.msgWindowByChannel.clear();
    this.rateTimer = window.setInterval(() => {
      const perSecond = (this.msgWindowCount * 1000) / this.rateSampleMs;
      const byChannel: Record<string, number> = {};
      for (const [channel, count] of this.msgWindowByChannel) {
        byChannel[channel] = count;
      }
      this.msgWindowCount = 0;
      this.msgWindowByChannel.clear();
      this.emitConnectionEvent({
        type: "rate_sample",
        timestamp: Date.now(),
        messagesPerSecond: Math.round(perSecond * 10) / 10,
        byChannel,
      });
    }, this.rateSampleMs);
  }

  private stopRateSampler() {
    if (this.rateTimer) {
      window.clearInterval(this.rateTimer);
      this.rateTimer = null;
    }
  }

  /**
   * Schedule reconnect with exponential backoff + full jitter
   * Prevents thundering herd when services recover.
   * See docs/phase1/index.md for implementation details.
   */
  private scheduleReconnect() {
    if (!this.shouldReconnect) return;
    if (this.reconnectTimeout) {
      window.clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    const exponentialDelay = Math.min(
      this.reconnectDelayMs * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelayMs
    );
    
    const jitter = Math.random() * exponentialDelay;
    const delay = Math.floor(jitter);
    
    this.reconnectAttempts += 1;
    const reconnectAt = Date.now() + delay;
    if (import.meta.env.DEV) {
      console.debug(
        `[WSClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}, base ${exponentialDelay}ms)`
      );
    }
    this.emitConnectionEvent({
      type: "reconnect_scheduled",
      timestamp: Date.now(),
      attempt: this.reconnectAttempts,
      delayMs: delay,
      reconnectAt,
    });

    const timeoutId = window.setTimeout(() => {
      if (this.reconnectTimeout !== timeoutId) return;
      this.reconnectTimeout = null;
      if (!this.shouldReconnect) return;
      this.connect();
    }, delay);

    this.reconnectTimeout = timeoutId;
  }
}
