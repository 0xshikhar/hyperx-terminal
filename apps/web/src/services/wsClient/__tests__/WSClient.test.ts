import { beforeEach, describe, expect, it, vi } from "vitest";
import { WSClient } from "../WSClient";
import { mockWebSocket, type MockWebSocketInstance } from "../../../test/mockWebSocket";

describe("WSClient", () => {
  let sockets: MockWebSocketInstance[];

  beforeEach(() => {
    sockets = [];
    vi.useFakeTimers();

    const MockSocket = vi.fn(() => {
      const socket = mockWebSocket();
      sockets.push(socket);
      return socket;
    });
    Object.assign(MockSocket, {
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3,
    });

    vi.stubGlobal("WebSocket", MockSocket);
  });

  it("replays active subscriptions after reconnect", () => {
    const client = new WSClient({
      url: "ws://localhost:3002",
      reconnectDelayMs: 10,
      maxReconnectDelayMs: 10,
    });

    client.subscribe("orderbook", "BTC-USD");
    client.subscribe("status");
    client.connect();

    expect(sockets).toHaveLength(1);
    sockets[0].simulateOpen();

    expect(sockets[0].getSentMessages()).toEqual([
      { type: "subscribe", channels: [{ channel: "orderbook", market: "BTC-USD" }] },
      { type: "subscribe", channels: [{ channel: "status" }] },
    ]);

    sockets[0].simulateClose(1006, "drop");
    vi.runOnlyPendingTimers();

    expect(sockets).toHaveLength(2);
    sockets[1].simulateOpen();

    expect(sockets[1].getSentMessages()).toEqual([
      { type: "subscribe", channels: [{ channel: "orderbook", market: "BTC-USD" }] },
      { type: "subscribe", channels: [{ channel: "status" }] },
    ]);
  });

  it("reference-counts duplicate subscriptions", () => {
    const client = new WSClient({ url: "ws://localhost:3002", reconnect: false });
    client.connect();
    sockets[0].simulateOpen();

    client.subscribe("orderbook", "ETH-USD");
    client.subscribe("orderbook", "ETH-USD");

    expect(sockets[0].getSentMessages()).toEqual([
      { type: "subscribe", channels: [{ channel: "orderbook", market: "ETH-USD" }] },
    ]);

    client.unsubscribe("orderbook", "ETH-USD");
    expect(sockets[0].getSentMessages()).toHaveLength(1);

    client.unsubscribe("orderbook", "ETH-USD");
    expect(sockets[0].getSentMessages()).toEqual([
      { type: "subscribe", channels: [{ channel: "orderbook", market: "ETH-USD" }] },
      { type: "unsubscribe", channels: [{ channel: "orderbook", market: "ETH-USD" }] },
    ]);
  });
});
