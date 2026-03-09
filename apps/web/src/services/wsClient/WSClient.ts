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
  private stateListeners = new Set<Listener<ConnectionState>>();

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
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.setState("connecting");
    
    // Append JWT token to URL for authentication
    const token = getToken();
    const url = token ? `${this.url}?token=${token}` : this.url;
    
    const ws = new WebSocket(url);

    ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.setState("connected");
    };

    ws.onmessage = (event) => {
      const raw = typeof event.data === "string" ? event.data : "";
      try {
        const parsed = serverMessageSchema.parse(JSON.parse(raw)) as ServerMessage;
        this.dispatch(parsed);
      } catch {
        return;
      }
    };

    ws.onclose = () => {
      this.setState("disconnected");
      if (!this.reconnect) return;
      this.scheduleReconnect();
    };

    ws.onerror = () => {
      this.setState("error");
    };

    this.ws = ws;
  }

  disconnect() {
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
    const usesRawChannel = typeof channel === "string" && channel.startsWith("candles:");
    this.send({
      type: "subscribe",
      channels: [usesRawChannel ? { channel } : { channel, market }],
    });
  }

  unsubscribe(channel: SubscribableChannel | CandlesChannel, market?: string) {
    const usesRawChannel = typeof channel === "string" && channel.startsWith("candles:");
    this.send({
      type: "unsubscribe",
      channels: [usesRawChannel ? { channel } : { channel, market }],
    });
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

  /**
   * Schedule reconnect with exponential backoff + full jitter
   * Prevents thundering herd when services recover.
   * See docs/phase1/index.md for implementation details.
   */
  private scheduleReconnect() {
    const exponentialDelay = Math.min(
      this.reconnectDelayMs * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelayMs
    );
    
    const jitter = Math.random() * exponentialDelay;
    const delay = Math.floor(jitter);
    
    this.reconnectAttempts += 1;
    console.log(`[WSClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}, base ${exponentialDelay}ms)`);
    
    this.reconnectTimeout = window.setTimeout(() => {
      this.connect();
    }, delay);
  }
}
