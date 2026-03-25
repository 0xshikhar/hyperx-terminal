import { describe, expect, it } from "vitest";
import { parseServerMessage } from "../fastMessageParser";

describe("fastMessageParser", () => {
  it("parses valid ticker messages", () => {
    const raw = JSON.stringify({
      type: "ticker",
      market: "BTC-USD",
      lastPrice: 76400.5,
      changePercent24h: 2.5,
      volume24h: 12345678,
      openInterest: 50.5,
      fundingRate: 0.0001,
      timestamp: 1710000000000,
    });

    const parsed = parseServerMessage(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe("ticker");
    if (parsed?.type === "ticker") {
      expect(parsed.market).toBe("BTC-USD");
      expect(parsed.lastPrice).toBe(76400.5);
      expect(parsed.fundingRate).toBe(0.0001);
    }
  });

  it("parses valid orderbook messages", () => {
    const raw = JSON.stringify({
      type: "orderbook",
      market: "ETH-USD",
      bids: [{ price: 2450, size: 10.5 }],
      asks: [{ price: 2451, size: 8.2 }],
      timestamp: 1710000000000,
    });

    const parsed = parseServerMessage(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe("orderbook");
    if (parsed?.type === "orderbook") {
      expect(parsed.market).toBe("ETH-USD");
      expect(parsed.bids).toHaveLength(1);
      expect(parsed.asks).toHaveLength(1);
    }
  });

  it("parses valid trades messages", () => {
    const raw = JSON.stringify({
      type: "trades",
      market: "SOL-USD",
      trades: [
        { id: "t1", side: "buy", price: 105.2, size: 40, timestamp: 1710000000000 },
      ],
      timestamp: 1710000000000,
    });

    const parsed = parseServerMessage(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe("trades");
    if (parsed?.type === "trades") {
      expect(parsed.market).toBe("SOL-USD");
      expect(parsed.trades[0].side).toBe("buy");
    }
  });

  it("parses valid candles messages", () => {
    const raw = JSON.stringify({
      type: "candles",
      market: "BTC-USD",
      interval: "1m",
      candles: [
        { time: 1710000000, open: 76000, high: 76100, low: 75900, close: 76050 },
      ],
      timestamp: 1710000000000,
    });

    const parsed = parseServerMessage(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe("candles");
    if (parsed?.type === "candles") {
      expect(parsed.interval).toBe("1m");
      expect(parsed.candles[0].close).toBe(76050);
    }
  });

  it("parses status and pong messages", () => {
    const statusRaw = JSON.stringify({
      type: "status",
      blockHeight: 123456,
      gasPrice: "0.5",
      timestamp: 1710000000000,
    });
    const pongRaw = JSON.stringify({
      type: "pong",
      timestamp: 1710000000000,
    });

    const parsedStatus = parseServerMessage(statusRaw);
    const parsedPong = parseServerMessage(pongRaw);

    expect(parsedStatus?.type).toBe("status");
    expect(parsedPong?.type).toBe("pong");
  });

  it("returns null for malformed or non-JSON strings", () => {
    expect(parseServerMessage("")).toBeNull();
    expect(parseServerMessage("not valid json {")).toBeNull();
    expect(parseServerMessage("null")).toBeNull();
    expect(parseServerMessage("123")).toBeNull();
    expect(parseServerMessage('"just a string"')).toBeNull();
  });

  it("returns null for unknown types or missing required fields", () => {
    // Missing required field 'lastPrice' in ticker
    expect(
      parseServerMessage(
        JSON.stringify({
          type: "ticker",
          market: "BTC-USD",
          timestamp: 1710000000000,
        })
      )
    ).toBeNull();

    // Unknown message type
    expect(
      parseServerMessage(
        JSON.stringify({
          type: "unknown_event_type",
          timestamp: 1710000000000,
        })
      )
    ).toBeNull();

    // Non-array bids in orderbook
    expect(
      parseServerMessage(
        JSON.stringify({
          type: "orderbook",
          market: "BTC-USD",
          bids: "not-an-array",
          asks: [],
          timestamp: 1710000000000,
        })
      )
    ).toBeNull();
  });
});
