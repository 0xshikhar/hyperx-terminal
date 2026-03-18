import { describe, expect, it } from "vitest";
import {
  canUseMasterParadexClient,
  demoTradesAllowed,
  hasParadexUserSession,
} from "../authz/paradexAccess.js";

describe("paradexAccess", () => {
  it("has no per-user Paradex session until PR-06a", () => {
    expect(hasParadexUserSession("user-1")).toBe(false);
  });

  it("allows master-key trading only for local DEMO_MODE + DEMO_ALLOW_TRADES", () => {
    expect(
      demoTradesAllowed({
        NODE_ENV: "development",
        DEMO_MODE: "true",
        DEMO_ALLOW_TRADES: "true",
      })
    ).toBe(true);
    expect(
      demoTradesAllowed({
        NODE_ENV: "production",
        DEMO_MODE: "true",
        DEMO_ALLOW_TRADES: "true",
      })
    ).toBe(false);
    expect(
      demoTradesAllowed({
        NODE_ENV: "development",
        DEMO_MODE: "true",
        DEMO_ALLOW_TRADES: "false",
      })
    ).toBe(false);
  });

  it("refuses the master client when no session and demo trades are off", () => {
    expect(
      canUseMasterParadexClient("user-1", {
        NODE_ENV: "test",
        DEMO_MODE: "false",
        DEMO_ALLOW_TRADES: "false",
      })
    ).toBe(false);
  });
});
