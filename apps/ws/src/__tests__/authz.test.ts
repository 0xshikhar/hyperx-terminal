import { describe, expect, it } from "vitest";
import { requiresAuth, validateAccountChannel } from "../auth.js";

describe("WS account channel authz", () => {
  it("requires auth for account channels only", () => {
    expect(requiresAuth("account:user-1")).toBe(true);
    expect(requiresAuth("orderbook:BTC-USD")).toBe(false);
    expect(requiresAuth("ticker")).toBe(false);
  });

  it("rejects subscribe to another user's account channel", () => {
    expect(validateAccountChannel("account:other-user", "user-1")).toBe(false);
  });

  it("allows subscribe to own account channel", () => {
    expect(validateAccountChannel("account:user-1", "user-1")).toBe(true);
  });

  it("rejects account channels when unauthenticated", () => {
    expect(validateAccountChannel("account:user-1", undefined)).toBe(false);
  });
});
