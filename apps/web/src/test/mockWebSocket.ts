/**
 * WebSocket Mock Utilities
 * 
 * Comprehensive mocking for WebSocket testing.
 * Part of Phase 6: Production Readiness.
 * 
 * Usage:
 *   import { mockWebSocket, MockWebSocketServer } from './mockWebSocket';
 *   const ws = mockWebSocket();
 *   ws.simulateMessage({ type: 'orderbook', data: {...} });
 */

import { vi, type Mock } from "vitest";

export type WebSocketMessage = 
  | { type: "orderbook"; market: string; bids: [number, number][]; asks: [number, number][] }
  | { type: "trade"; market: string; price: number; size: number; side: "buy" | "sell" }
  | { type: "ticker"; market: string; price: number; change24h: number }
  | { type: "order_update"; orderId: string; status: string; filledSize: number }
  | { type: "error"; message: string; code: number }
  | Record<string, unknown>;

export interface MockWebSocketInstance {
  // WebSocket API
  readyState: number;
  CONNECTING: 0;
  OPEN: 1;
  CLOSING: 2;
  CLOSED: 3;
  
  send: Mock<[data: unknown], void>;
  close: Mock<[code?: number, reason?: string], void>;
  
  // Event handlers
  onopen: ((event: Event) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  
  // Simulation methods
  simulateOpen: () => void;
  simulateClose: (code?: number, reason?: string) => void;
  simulateMessage: (data: WebSocketMessage) => void;
  simulateError: (error: Error) => void;
  
  // Spy utilities
  getSentMessages: () => unknown[];
  lastSentMessage: () => unknown | undefined;
  wasClosed: () => boolean;
}

export function mockWebSocket(): MockWebSocketInstance {
  const sentMessages: unknown[] = [];
  let closed = false;
  
  const instance: MockWebSocketInstance = {
    readyState: 0,
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
    
    send: vi.fn((data: unknown) => {
      sentMessages.push(typeof data === "string" ? JSON.parse(data) : data);
    }),
    
    close: vi.fn((code?: number, reason?: string) => {
      closed = true;
      instance.readyState = 3;
      if (instance.onclose) {
        instance.onclose(new CloseEvent("close", { code, reason }));
      }
    }),
    
    onopen: null,
    onclose: null,
    onmessage: null,
    onerror: null,
    
    simulateOpen: () => {
      instance.readyState = 1;
      if (instance.onopen) {
        instance.onopen(new Event("open"));
      }
    },
    
    simulateClose: (code = 1000, reason = "Normal closure") => {
      closed = true;
      instance.readyState = 3;
      if (instance.onclose) {
        instance.onclose(new CloseEvent("close", { code, reason }));
      }
    },
    
    simulateMessage: (data: WebSocketMessage) => {
      if (instance.onmessage) {
        instance.onmessage(new MessageEvent("message", {
          data: typeof data === "string" ? data : JSON.stringify(data),
        }));
      }
    },
    
    simulateError: (error: Error) => {
      if (instance.onerror) {
        instance.onerror(new ErrorEvent("error", { error }));
      }
    },
    
    getSentMessages: () => [...sentMessages],
    lastSentMessage: () => sentMessages[sentMessages.length - 1],
    wasClosed: () => closed,
  };
  
  return instance;
}

export class MockWebSocketServer {
  private clients: MockWebSocketInstance[] = [];
  
  constructor(_url = "wss://test.example.com") {}
  
  connect(): MockWebSocketInstance {
    const client = mockWebSocket();
    this.clients.push(client);
    
    // Auto-open after small delay (like real WebSocket)
    setTimeout(() => {
      client.simulateOpen();
    }, 10);
    
    return client;
  }
  
  disconnect(client: MockWebSocketInstance): void {
    const index = this.clients.indexOf(client);
    if (index > -1) {
      this.clients.splice(index, 1);
      client.simulateClose();
    }
  }
  
  disconnectAll(): void {
    [...this.clients].forEach(client => this.disconnect(client));
  }
  
  broadcast(message: WebSocketMessage): void {
    this.clients.forEach(client => {
      if (client.readyState === 1) { // OPEN
        client.simulateMessage(message);
      }
    });
  }
  
  broadcastToMarket(market: string, message: WebSocketMessage): void {
    this.clients.forEach(client => {
      // Simulate market filtering (clients subscribe to specific markets)
      const lastSub = client.getSentMessages()
        .filter(m => (m as { type: string }).type === "subscribe")
        .pop();
      
      if (lastSub && (lastSub as { market?: string }).market === market) {
        client.simulateMessage(message);
      }
    });
  }
  
  simulateNetworkLatency(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  simulateConnectionDrop(): void {
    this.clients.forEach(client => {
      client.simulateClose(1006, "Connection dropped");
    });
  }
  
  simulateReconnect(): void {
    this.disconnectAll();
    // Clients should reconnect automatically
  }
  
  getClientCount(): number {
    return this.clients.length;
  }
  
  getConnectedClients(): MockWebSocketInstance[] {
    return this.clients.filter(c => c.readyState === 1);
  }
}

// Higher-level helpers for common scenarios
export function createOrderBookStream(
  market: string,
  options: { priceStart?: number; spread?: number; depth?: number } = {}
): WebSocketMessage {
  const { priceStart = 50000, spread = 10, depth = 10 } = options;
  
  const bids: [number, number][] = [];
  const asks: [number, number][] = [];
  
  for (let i = 0; i < depth; i++) {
    bids.push([priceStart - (i + 1) * spread, Math.random() * 10]);
    asks.push([priceStart + (i + 1) * spread, Math.random() * 10]);
  }
  
  return {
    type: "orderbook",
    market,
    bids,
    asks,
  };
}

export function createTradeMessage(
  market: string,
  options: { price?: number; size?: number; side?: "buy" | "sell" } = {}
): WebSocketMessage {
  return {
    type: "trade",
    market,
    price: options.price ?? 50000,
    size: options.size ?? 0.5,
    side: options.side ?? "buy",
  };
}

export function createOrderUpdate(
  orderId: string,
  status: string,
  filledSize: number
): WebSocketMessage {
  return {
    type: "order_update",
    orderId,
    status,
    filledSize,
  };
}

// Throttling simulation
export function simulateHighFrequencyMessages(
  ws: MockWebSocketInstance,
  messageFactory: (i: number) => WebSocketMessage,
  count: number,
  intervalMs: number
): Promise<void> {
  return new Promise((resolve) => {
    let i = 0;
    const interval = setInterval(() => {
      if (i >= count) {
        clearInterval(interval);
        resolve();
        return;
      }
      ws.simulateMessage(messageFactory(i));
      i++;
    }, intervalMs);
  });
}

// Binary message support (for msgpack)
export function mockBinaryWebSocket(): MockWebSocketInstance & {
  simulateBinaryMessage: (data: Uint8Array) => void;
} {
  const base = mockWebSocket();
  
  return {
    ...base,
    simulateBinaryMessage: (data: Uint8Array) => {
      if (base.onmessage) {
        base.onmessage(new MessageEvent("message", { data }));
      }
    },
  };
}

// Usage example in tests:
/**
 * import { describe, it, expect, vi, beforeEach } from 'vitest';
 * import { mockWebSocket, MockWebSocketServer, createOrderBookStream } from './mockWebSocket';
 * 
 * describe('WebSocket Client', () => {
 *   let ws: MockWebSocketInstance;
 *   let server: MockWebSocketServer;
 *   
 *   beforeEach(() => {
 *     server = new MockWebSocketServer();
 *     ws = server.connect();
 *   });
 *   
 *   it('should handle orderbook updates', () => {
 *     const handler = vi.fn();
 *     ws.onmessage = handler;
 *     
 *     ws.simulateOpen();
 *     ws.simulateMessage(createOrderBookStream('BTC-USD'));
 *     
 *     expect(handler).toHaveBeenCalled();
 *     const data = JSON.parse(handler.mock.calls[0][0].data);
 *     expect(data.type).toBe('orderbook');
 *   });
 * });
 */
