import type {
  CandlesChannel,
  ClientMessage,
  ChannelPayloadMap,
  ServerMessage,
  SubscribableChannel,
  WSChannel,
} from "./channelTypes";
import { serverMessageSchema } from "./messageParser";
import { getToken } from "../auth.service";

export type ConnectionState = "connecting" | "connected" | "disconnected" | "error";

type Listener<T> = { bivarianceHack(payload: T): void }["bivarianceHack"];

type WSClientOptions = {
  url: string;
  reconnect?: boolean;
  reconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
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
  private stateListeners = new Set<Listener<ConnectionState>>();
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
  }

  get connectionState() {
    return this.state;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.shouldReconnect = true;
    this.setState("connecting");
    
    // Append JWT token to URL for authentication
    const token = getToken();
    const url = token ? `${this.url}?token=${token}` : this.url;
    
    const ws = new WebSocket(url);

    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.reconnectAttempts = 0;
      this.setState("connected");
      this.resubscribeAll();
    };

    ws.onmessage = (event) => {
      if (this.ws !== ws) return;
      const raw = typeof event.data === "string" ? event.data : "";
      try {
        const parsed = serverMessageSchema.parse(JSON.parse(raw)) as ServerMessage;
        this.dispatch(parsed);
      } catch {
        return;
      }
    };

    ws.onclose = () => {
      if (this.ws === ws) {
        this.ws = null;
      }
      this.setState("disconnected");
      if (!this.reconnect || !this.shouldReconnect) return;
      this.scheduleReconnect();
    };

    ws.onerror = () => {
      if (this.ws !== ws) return;
      this.setState("error");
    };

    this.ws = ws;
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimeout) {
      window.clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.ws?.close();
    this.ws = null;
    this.setState("disconnected");
  }

  send(message: ClientMessage) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(message));
  }

  subscribe(channel: SubscribableChannel | CandlesChannel, market?: string) {
    const key = this.subscriptionKey(channel, market);
    const existing = this.activeSubscriptions.get(key);
    if (existing) {
      existing.count += 1;
      return;
    }

    this.activeSubscriptions.set(key, { channel, market, count: 1 });
    this.sendSubscription("subscribe", channel, market);
  }

  unsubscribe(channel: SubscribableChannel | CandlesChannel, market?: string) {
    const key = this.subscriptionKey(channel, market);
    const existing = this.activeSubscriptions.get(key);
    if (!existing) return;

    if (existing.count > 1) {
      existing.count -= 1;
      return;
    }

    this.activeSubscriptions.delete(key);
    this.sendSubscription("unsubscribe", channel, market);
  }

  onStateChange(listener: Listener<ConnectionState>) {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
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
    this.send({ type: "ping", timestamp: performance.now() });
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

  private sendSubscription(
    type: "subscribe" | "unsubscribe",
    channel: SubscribableChannel | CandlesChannel,
    market?: string
  ) {
    const usesRawChannel = typeof channel === "string" && channel.startsWith("candles:");
    this.send({
      type,
      channels: [usesRawChannel ? { channel } : { channel, market }],
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
    if (import.meta.env.DEV) {
      console.debug(
        `[WSClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}, base ${exponentialDelay}ms)`
      );
    }

    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectTimeout = null;
      if (!this.shouldReconnect) return;
      this.connect();
    }, delay);
  }
}
