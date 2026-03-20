import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { env } from "../config/env.js";

vi.mock("../db/client.js", () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
  },
}));

const { app } = await import("../index.js");

function signPayload(body: unknown, timestamp: number, secret = env.INGEST_HMAC_SECRET || env.JWT_SECRET) {
  const raw = JSON.stringify(body);
  const hmac = createHmac("sha256", secret);
  hmac.update(`${timestamp}.${raw}`);
  return `sha256=${hmac.digest("hex")}`;
}

describe("HMAC /internal/ticks endpoint", () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 401 when ingest headers are missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/internal/ticks",
      payload: { ticks: [] },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: "missing_ingest_auth" });
  });

  it("returns 401 when timestamp is stale (> 60s)", async () => {
    const staleTs = Date.now() - 100_000;
    const body = { ticks: [] };
    const sig = signPayload(body, staleTs);

    const res = await app.inject({
      method: "POST",
      url: "/internal/ticks",
      headers: {
        "x-hyperx-timestamp": String(staleTs),
        "x-hyperx-ingest": sig,
      },
      payload: body,
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: "stale_timestamp" });
  });

  it("returns 403 when signature is invalid", async () => {
    const now = Date.now();
    const body = { ticks: [] };

    const res = await app.inject({
      method: "POST",
      url: "/internal/ticks",
      headers: {
        "x-hyperx-timestamp": String(now),
        "x-hyperx-ingest": "sha256=invalid_hash",
      },
      payload: body,
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ error: "invalid_hmac_signature" });
  });

  it("returns 200 and accepts valid ticks when HMAC signature is valid", async () => {
    const now = Date.now();
    const body = {
      ticks: [
        {
          channel: "orderbook",
          network: "testnet",
          market: "BTC-USD",
          bids: [["90000", "1.5"]],
          asks: [["90050", "2.0"]],
          ts: now,
        },
      ],
    };
    const sig = signPayload(body, now);

    const res = await app.inject({
      method: "POST",
      url: "/internal/ticks",
      headers: {
        "x-hyperx-timestamp": String(now),
        "x-hyperx-ingest": sig,
      },
      payload: body,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ accepted: 1 });
  });
});
