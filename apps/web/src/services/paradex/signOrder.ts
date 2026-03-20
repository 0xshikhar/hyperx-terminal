import { shortString } from "starknet";
import type { TypedData } from "starknet";

const DOMAIN_TYPES = {
  StarkNetDomain: [
    { name: "name", type: "felt" },
    { name: "chainId", type: "felt" },
    { name: "version", type: "felt" },
  ],
};

export function buildParadexDomain(starknetChainId: string) {
  let normalizedChainId = starknetChainId;
  if (!starknetChainId.startsWith("0x") && !/^\d+$/.test(starknetChainId)) {
    normalizedChainId = shortString.encodeShortString(starknetChainId);
  }
  return {
    name: "Paradex",
    chainId: normalizedChainId,
    version: "1",
  };
}

export function toQuantums(value: string, precision: number = 8): string {
  const [whole, fraction = ""] = value.split(".");
  const sanitizedWhole = (whole || "0").replace(/^0+(?=\d)/, "") || "0";
  const paddedFraction = `${fraction}00000000000000000000`.slice(0, precision);
  const combined = `${sanitizedWhole}${paddedFraction}`.replace(/^0+(?=\d)/, "") || "0";
  return combined;
}

export interface BuildOrderPayloadOptions {
  timestamp: number;
  market: string;
  side: "BUY" | "SELL";
  orderType: string;
  size: string;
  price?: string;
  chainId: string;
}

export function buildOrderTypedData(opts: BuildOrderPayloadOptions): TypedData {
  const domain = buildParadexDomain(opts.chainId);
  const sideForSigning = opts.side === "BUY" ? "1" : "2";
  const priceForSigning = opts.price ?? "0";
  const priceQuantums = toQuantums(priceForSigning, 8);
  const sizeQuantums = toQuantums(opts.size, 8);
  const orderTypeFelt = shortString.encodeShortString(opts.orderType);
  const marketFelt = shortString.encodeShortString(opts.market);

  return {
    domain,
    primaryType: "Order",
    types: {
      ...DOMAIN_TYPES,
      Order: [
        { name: "timestamp", type: "felt" },
        { name: "market", type: "felt" },
        { name: "side", type: "felt" },
        { name: "orderType", type: "felt" },
        { name: "size", type: "felt" },
        { name: "price", type: "felt" },
      ],
    },
    message: {
      timestamp: opts.timestamp,
      market: marketFelt,
      side: sideForSigning,
      orderType: orderTypeFelt,
      size: sizeQuantums,
      price: priceQuantums,
    },
  };
}

export interface BuildAuthRequestOptions {
  method: string;
  path: string;
  body?: string;
  timestamp: number;
  expiration: number;
  chainId: string;
}

export function buildAuthTypedData(opts: BuildAuthRequestOptions): TypedData {
  const domain = buildParadexDomain(opts.chainId);
  return {
    domain,
    primaryType: "Request",
    types: {
      ...DOMAIN_TYPES,
      Request: [
        { name: "method", type: "felt" },
        { name: "path", type: "felt" },
        { name: "body", type: "felt" },
        { name: "timestamp", type: "felt" },
        { name: "expiration", type: "felt" },
      ],
    },
    message: {
      method: shortString.encodeShortString(opts.method),
      path: shortString.encodeShortString(opts.path),
      body: opts.body || "",
      timestamp: opts.timestamp,
      expiration: opts.expiration,
    },
  };
}
