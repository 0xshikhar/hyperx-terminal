import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();

vi.mock("../db/client.js", () => ({
  prisma: {
    user: { findUnique },
    $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
  },
}));

vi.mock("../services/notifications.service.js", () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
  formatNotifAmount: (value: string) => value,
}));

const { app } = await import("../index.js");

const validOrder = {
  market: "BTC-USD",
  side: "buy" as const,
  type: "market" as const,
  size: "0.01",
};

function authedUser(overrides: { tokenVersion?: number } = {}) {
  return {
    id: "user-1",
    tokenVersion: overrides.tokenVersion ?? 0,
    walletAddress: "0xabc",
    username: null,
    email: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    preferences: null,
  };
}

describe("money-path authz", () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    findUnique.mockReset();
  });

  it("POST /api/orders without a JWT is 401 and does not trade", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/orders",
      payload: validOrder,
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: "Authentication required" });
  });

  it("GET /api/positions without a JWT is 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/positions" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/orders without a JWT is 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/orders" });
    expect(res.statusCode).toBe(401);
  });

  it("authenticated without a Paradex session cannot place an order", async () => {
    findUnique.mockResolvedValue(authedUser());
    const token = app.jwt.sign({
      userId: "user-1",
      walletAddress: "0xabc",
      tokenVersion: 0,
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/orders",
      headers: { authorization: `Bearer ${token}` },
      payload: validOrder,
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ error: "paradex_session_expired" });
  });

  it("authenticated without a Paradex session gets empty positions, not the operator book", async () => {
    findUnique.mockResolvedValue(authedUser());
    const token = app.jwt.sign({
      userId: "user-1",
      walletAddress: "0xabc",
      tokenVersion: 0,
    });
    const res = await app.inject({
      method: "GET",
      url: "/api/positions",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ positions: [] });
  });

  it("tokenVersion mismatch is 401", async () => {
    findUnique.mockResolvedValue(authedUser({ tokenVersion: 2 }));
    const token = app.jwt.sign({
      userId: "user-1",
      walletAddress: "0xabc",
      tokenVersion: 0,
    });
    const res = await app.inject({
      method: "GET",
      url: "/api/account",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: "Session expired" });
  });

  it("cancel without a Paradex session is 503, not a lying 200", async () => {
    findUnique.mockResolvedValue(authedUser());
    const token = app.jwt.sign({
      userId: "user-1",
      walletAddress: "0xabc",
      tokenVersion: 0,
    });
    const res = await app.inject({
      method: "DELETE",
      url: "/api/orders/order-1",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ error: "paradex_unavailable" });
  });

  it("GET /api/leaderboard is an empty list", async () => {
    const res = await app.inject({ method: "GET", url: "/api/leaderboard" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      leaderboard: [],
      leadersCount: 0,
    });
    expect(JSON.stringify(res.json())).not.toContain("Principal Engineer");
  });
});
