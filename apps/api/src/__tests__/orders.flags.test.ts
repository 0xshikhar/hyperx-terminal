import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const createOrder = vi.fn();
const cancelOrder = vi.fn();
const cancelAllOrders = vi.fn();

vi.mock("../db/client.js", () => ({
  prisma: {
    user: { findUnique },
    $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
  },
}));

vi.mock("../dex/session.js", () => ({
  getUserParadexClient: vi.fn(async () => ({
    createOrder,
    cancelOrder,
    cancelAllOrders,
    getOpenOrders: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock("../services/notifications.service.js", () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
  formatNotifAmount: (value: string) => value,
}));

const { app } = await import("../index.js");

function authedUser() {
  return {
    id: "user-1",
    tokenVersion: 0,
    walletAddress: "0xabc",
    username: null,
    email: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    preferences: null,
  };
}

function authHeader() {
  const token = app.jwt.sign({
    userId: "user-1",
    walletAddress: "0xabc",
    tokenVersion: 0,
  });
  return { authorization: `Bearer ${token}` };
}

describe("order venue-flag forwarding", () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    findUnique.mockResolvedValue(authedUser());
    createOrder.mockResolvedValue({ id: "venue-1" });
    cancelOrder.mockResolvedValue(undefined);
    cancelAllOrders.mockResolvedValue({ canceled: ["a", "b"] });
  });

  it("forwards reduceOnly + POST_ONLY instruction to the venue client", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/orders",
      headers: authHeader(),
      payload: {
        market: "BTC-USD",
        side: "sell",
        type: "limit",
        size: "0.01",
        price: "50000",
        reduceOnly: true,
        instruction: "POST_ONLY",
      },
    });
    expect(res.statusCode).toBe(200);
    expect(createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        market: "BTC-USD-PERP",
        side: "SELL",
        type: "LIMIT",
        postOnly: true,
        reduceOnly: true,
        timeInForce: "GTC",
      })
    );
  });

  it("maps instruction IOC to venue timeInForce", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/orders",
      headers: authHeader(),
      payload: {
        market: "ETH-USD",
        side: "buy",
        type: "market",
        size: "0.1",
        instruction: "IOC",
      },
    });
    expect(res.statusCode).toBe(200);
    expect(createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ type: "MARKET", timeInForce: "IOC" })
    );
  });

  it("rejects an invalid instruction instead of passing it through", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/orders",
      headers: authHeader(),
      payload: {
        market: "BTC-USD",
        side: "buy",
        type: "market",
        size: "0.01",
        instruction: "TWAP",
      },
    });
    expect(res.statusCode).toBe(400);
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("DELETE /api/orders/:id forwards the venue order id", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/api/orders/abc-123",
      headers: authHeader(),
    });
    expect(res.statusCode).toBe(200);
    expect(cancelOrder).toHaveBeenCalledWith("abc-123");
  });

  it("DELETE /api/orders forwards cancel-all with market filter", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/api/orders?market=BTC-USD",
      headers: authHeader(),
    });
    expect(res.statusCode).toBe(200);
    expect(cancelAllOrders).toHaveBeenCalledWith("BTC-USD-PERP");
    expect(res.json()).toMatchObject({ canceled: ["a", "b"] });
  });
});
