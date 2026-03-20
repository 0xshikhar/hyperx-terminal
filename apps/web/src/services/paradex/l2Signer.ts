import { ec, typedData } from "starknet";
import type { AccountInterface, TypedData } from "starknet";
import {
  buildOrderTypedData,
  buildAuthTypedData,
} from "./signOrder.js";
import type {
  BuildOrderPayloadOptions,
  BuildAuthRequestOptions,
} from "./signOrder.js";

export interface ParadexSigner {
  accountAddress: string;
  signTypedData(payload: TypedData): Promise<string>;
  signOrder(opts: Omit<BuildOrderPayloadOptions, "timestamp">): Promise<{
    signature: string;
    signatureTimestamp: number;
  }>;
  signAuthRequest(opts: Omit<BuildAuthRequestOptions, "timestamp" | "expiration">): Promise<{
    headers: Record<string, string>;
    timestamp: number;
    expiration: number;
  }>;
}

// In-memory key storage (never written to localStorage/sessionStorage/cookies)
let inMemoryPrivateKey: string | null = null;
let inMemoryAccountAddress: string | null = null;

export function setSessionL2Credentials(accountAddress: string, privateKey: string) {
  inMemoryAccountAddress = accountAddress;
  inMemoryPrivateKey = privateKey;
}

export function clearSessionL2Credentials() {
  inMemoryAccountAddress = null;
  inMemoryPrivateKey = null;
}

export function hasSessionL2Credentials(): boolean {
  return Boolean(inMemoryAccountAddress && inMemoryPrivateKey);
}

export function getSessionL2Address(): string | null {
  return inMemoryAccountAddress;
}

export class LocalKeyParadexSigner implements ParadexSigner {
  public readonly accountAddress: string;
  private readonly privateKey: string;

  constructor(accountAddress: string, privateKey: string) {
    this.accountAddress = accountAddress;
    this.privateKey = privateKey;
  }

  async signTypedData(payload: TypedData): Promise<string> {
    const messageHash = typedData.getMessageHash(payload, this.accountAddress);
    const signature = ec.starkCurve.sign(messageHash, this.privateKey);

    if (
      typeof signature === "object" &&
      signature !== null &&
      "r" in signature &&
      "s" in signature
    ) {
      const r = (signature as { r: bigint | number | string }).r;
      const s = (signature as { s: bigint | number | string }).s;
      return JSON.stringify([r.toString(10), s.toString(10)]);
    }

    if (Array.isArray(signature)) {
      return JSON.stringify((signature as (string | number | bigint)[]).map((x) => String(x)));
    }

    return JSON.stringify([String(signature)]);
  }

  async signOrder(opts: Omit<BuildOrderPayloadOptions, "timestamp">): Promise<{
    signature: string;
    signatureTimestamp: number;
  }> {
    const signatureTimestamp = Date.now();
    const payload = buildOrderTypedData({
      ...opts,
      timestamp: signatureTimestamp,
    });
    const signature = await this.signTypedData(payload);
    return {
      signature,
      signatureTimestamp,
    };
  }

  async signAuthRequest(
    opts: Omit<BuildAuthRequestOptions, "timestamp" | "expiration">
  ): Promise<{
    headers: Record<string, string>;
    timestamp: number;
    expiration: number;
  }> {
    const timestamp = Math.floor(Date.now() / 1000);
    const expiration = timestamp + 24 * 60 * 60; // 24 hours
    const payload = buildAuthTypedData({
      ...opts,
      timestamp,
      expiration,
    });
    const signature = await this.signTypedData(payload);

    return {
      headers: {
        "PARADEX-STARKNET-ACCOUNT": this.accountAddress,
        "PARADEX-STARKNET-SIGNATURE": signature,
        "PARADEX-TIMESTAMP": String(timestamp),
        "PARADEX-SIGNATURE-EXPIRATION": String(expiration),
      },
      timestamp,
      expiration,
    };
  }
}

export class WalletAccountParadexSigner implements ParadexSigner {
  public readonly accountAddress: string;
  private readonly account: AccountInterface;

  constructor(accountAddress: string, account: AccountInterface) {
    this.accountAddress = accountAddress;
    this.account = account;
  }

  async signTypedData(payload: TypedData): Promise<string> {
    const sig = await this.account.signMessage(payload);
    if (Array.isArray(sig)) {
      return JSON.stringify(sig.map((s) => String(s)));
    }
    return JSON.stringify([String(sig)]);
  }

  async signOrder(opts: Omit<BuildOrderPayloadOptions, "timestamp">): Promise<{
    signature: string;
    signatureTimestamp: number;
  }> {
    const signatureTimestamp = Date.now();
    const payload = buildOrderTypedData({
      ...opts,
      timestamp: signatureTimestamp,
    });
    const signature = await this.signTypedData(payload);
    return {
      signature,
      signatureTimestamp,
    };
  }

  async signAuthRequest(
    opts: Omit<BuildAuthRequestOptions, "timestamp" | "expiration">
  ): Promise<{
    headers: Record<string, string>;
    timestamp: number;
    expiration: number;
  }> {
    const timestamp = Math.floor(Date.now() / 1000);
    const expiration = timestamp + 24 * 60 * 60;
    const payload = buildAuthTypedData({
      ...opts,
      timestamp,
      expiration,
    });
    const signature = await this.signTypedData(payload);

    return {
      headers: {
        "PARADEX-STARKNET-ACCOUNT": this.accountAddress,
        "PARADEX-STARKNET-SIGNATURE": signature,
        "PARADEX-TIMESTAMP": String(timestamp),
        "PARADEX-SIGNATURE-EXPIRATION": String(expiration),
      },
      timestamp,
      expiration,
    };
  }
}

export function getParadexSigner(walletAccount?: AccountInterface | null): ParadexSigner | null {
  if (inMemoryAccountAddress && inMemoryPrivateKey) {
    return new LocalKeyParadexSigner(inMemoryAccountAddress, inMemoryPrivateKey);
  }

  if (walletAccount && walletAccount.address) {
    return new WalletAccountParadexSigner(walletAccount.address, walletAccount);
  }

  return null;
}
