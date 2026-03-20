import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const findUniqueUser = vi.fn();
const findUniqueSession = vi.fn();
const findFirstSession = vi.fn();
const upsertSession = vi.fn();
const deleteManySession = vi.fn();

vi.mock("../db/client.js", () => ({
  prisma: {
    user: { findUnique: findUniqueUser },
    paradexSession: {
      findUnique: findUniqueSession,
      findFirst: findFirstSession,
      upsert: upsertSession,
      deleteMany: deleteManySession,
    },
    $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
  },
}));

vi.mock("../dex/ParadexUserClient.js", () => {
  return {
    ParadexUserClient: class MockParadexUserClient {
      constructor(public opts: { l2Account: string; jwt: string }) {}
      async getAccount() {
        if (this.opts.jwt === "invalid_jwt") {
          throw new Error("Invalid token");
        }
        if (this.opts.jwt === "mismatch_jwt") {
          return { account: "0x9999mismatch", address: "0x9999mismatch" };
        }
        return { account: this.opts.l2Account, address: this.opts.l2Account };
      }
    },
  };
});

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

describe("paradex session endpoints", () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    findUniqueUser.mockReset();
    findUniqueSession.mockReset();
    findFirstSession.mockReset();
    upsertSession.mockReset();
    deleteManySession.mockReset();
  });

  it("GET /api/dex/paradex/session without JWT is 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/dex/paradex/session",
    });
    expect(res.statusCode).toBe(401);
  });

  it("POST /api/dex/paradex/session without JWT is 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/dex/paradex/session",
      payload: { jwt: "some_jwt", l2Account: "0x123", network: "testnet" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("POST /api/dex/paradex/session with invalid jwt returns 403", async () => {
    const token = app.jwt.sign({ userId: "user-1", tokenVersion: 0 });
    findUniqueUser.mockResolvedValue(authedUser());

    const res = await app.inject({
      method: "POST",
      url: "/api/dex/paradex/session",
      headers: { authorization: `Bearer ${token}` },
      payload: { jwt: "invalid_jwt", l2Account: "0x123", network: "testnet" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ error: "paradex_jwt_invalid" });
  });

  it("POST /api/dex/paradex/session with address mismatch returns 403", async () => {
    const token = app.jwt.sign({ userId: "user-1", tokenVersion: 0 });
    findUniqueUser.mockResolvedValue(authedUser());

    const res = await app.inject({
      method: "POST",
      url: "/api/dex/paradex/session",
      headers: { authorization: `Bearer ${token}` },
      payload: { jwt: "mismatch_jwt", l2Account: "0x123", network: "testnet" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ error: "paradex_jwt_mismatch" });
  });

  it("POST /api/dex/paradex/session bound to another user returns 409", async () => {
    const token = app.jwt.sign({ userId: "user-1", tokenVersion: 0 });
    findUniqueUser.mockResolvedValue(authedUser());
    findFirstSession.mockResolvedValue({ id: "session-other", userId: "user-2", l2Account: "0x123" });

    const res = await app.inject({
      method: "POST",
      url: "/api/dex/paradex/session",
      headers: { authorization: `Bearer ${token}` },
      payload: { jwt: "valid_jwt", l2Account: "0x123", network: "testnet" },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ error: "paradex_account_bound" });
  });

  it("POST /api/dex/paradex/session success binds session and returns 200", async () => {
    const token = app.jwt.sign({ userId: "user-1", tokenVersion: 0 });
    findUniqueUser.mockResolvedValue(authedUser());
    findFirstSession.mockResolvedValue(null);
    upsertSession.mockResolvedValue({ id: "session-1", userId: "user-1", l2Account: "0x123", network: "testnet" });

    const res = await app.inject({
      method: "POST",
      url: "/api/dex/paradex/session",
      headers: { authorization: `Bearer ${token}` },
      payload: { jwt: "valid_jwt", l2Account: "0x123", network: "testnet" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ l2Account: "0x123", network: "testnet", onboarded: true });
    expect(upsertSession).toHaveBeenCalled();
  });

  it("DELETE /api/dex/paradex/session deletes session and returns 200", async () => {
    const token = app.jwt.sign({ userId: "user-1", tokenVersion: 0 });
    findUniqueUser.mockResolvedValue(authedUser());
    deleteManySession.mockResolvedValue({ count: 1 });

    const res = await app.inject({
      method: "DELETE",
      url: "/api/dex/paradex/session",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true });
  });
});
