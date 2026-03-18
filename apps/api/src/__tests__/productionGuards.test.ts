import { describe, expect, it, vi } from "vitest";
import {
  collectProductionGuardErrors,
  enforceProductionGuards,
} from "../config/productionGuards.js";

const productionBase = {
  NODE_ENV: "production",
  JWT_SECRET: "not-the-default-secret",
};

describe("collectProductionGuardErrors", () => {
  it("allows a clean production boot", () => {
    expect(collectProductionGuardErrors(productionBase)).toEqual([]);
  });

  it("rejects DEMO_MODE in production", () => {
    expect(
      collectProductionGuardErrors({ ...productionBase, DEMO_MODE: "true" })
    ).toContain("DEMO_MODE");
  });

  it("rejects DEMO_ALLOW_TRADES in production", () => {
    expect(
      collectProductionGuardErrors({ ...productionBase, DEMO_ALLOW_TRADES: "true" })
    ).toContain("DEMO_ALLOW_TRADES");
  });

  it("rejects FF_ALLOW_MASTER_KEY in production", () => {
    expect(
      collectProductionGuardErrors({ ...productionBase, FF_ALLOW_MASTER_KEY: "true" })
    ).toContain("FF_ALLOW_MASTER_KEY");
  });

  it("rejects a Paradex master private key in production", () => {
    expect(
      collectProductionGuardErrors({
        ...productionBase,
        PARADEX_STARKNET_PRIVATE_KEY: "0xabc",
      })
    ).toContain("PARADEX_STARKNET_PRIVATE_KEY");
  });

  it("treats an empty private key as unset", () => {
    expect(
      collectProductionGuardErrors({
        ...productionBase,
        PARADEX_STARKNET_PRIVATE_KEY: "",
      })
    ).toEqual([]);
  });

  it("does not apply production guards in development", () => {
    expect(
      collectProductionGuardErrors({
        NODE_ENV: "development",
        DEMO_MODE: "true",
        DEMO_ALLOW_TRADES: "true",
        PARADEX_STARKNET_PRIVATE_KEY: "0xabc",
        JWT_SECRET: "dev-jwt-secret-change-in-production",
      })
    ).toEqual([]);
  });

  it("exits non-zero when DEMO_MODE is set in production", () => {
    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    enforceProductionGuards({
      NODE_ENV: "production",
      DEMO_MODE: "true",
      JWT_SECRET: "not-the-default-secret",
    });
    expect(exit).toHaveBeenCalledWith(1);
    exit.mockRestore();
    error.mockRestore();
  });
});
