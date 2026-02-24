/**
 * Paradex DEX Client
 * 
 * Client for interacting with Paradex DEX API
 * Supports perpetual futures trading on Starknet
 */

import type {
  DEXConfig,
  ParadexMarket,
  ParadexOrderbook,
  ParadexOrder,
  ParadexTrade,
  ParadexPosition,
  ParadexBalance,
  ParadexCreateOrderRequest,
} from "@hyperx/types/dex";

import { ec, shortString, typedData } from "starknet";
import type { TypedData } from "starknet";

export interface ParadexClientOptions extends DEXConfig {
  credentials?: {
    starknetAddress?: string;
    starknetPrivateKey?: string;
    jwtToken?: string;
  };
  jwtToken?: string;
}

type ParadexResults<T> = {
  results?: T[];
  next?: string;
  prev?: string;
};

type ParadexAccountInfo = Record<string, unknown>;

export class ParadexClient {
  private baseUrl: string;
  private starknetAddress?: string;
  private starknetPrivateKey?: string;
  private jwtToken?: string;
  private jwtExpiresAt: number = 0;
  private chainId?: string;
  private timeout: number;

  constructor(options: ParadexClientOptions) {
    this.baseUrl = this.normalizeBaseUrl(options.baseUrl);
    this.starknetAddress = options.credentials?.starknetAddress;
    this.starknetPrivateKey = options.credentials?.starknetPrivateKey;
    this.jwtToken = options.credentials?.jwtToken || options.jwtToken;
    if (this.jwtToken) {
      this.jwtExpiresAt = Number.POSITIVE_INFINITY;
    }
    if (Number.isFinite(options.chainId) && options.chainId > 0) {
      this.chainId = String(options.chainId);
    }
    this.timeout = options.timeout || 30000;
  }

  private normalizeBaseUrl(baseUrl: string): string {
    const trimmed = baseUrl.replace(/\/+$/, "");
    return trimmed.endsWith("/v1") ? trimmed.slice(0, -3) : trimmed;
  }

  private normalizeChainId(chainId: string): string {
    if (chainId.startsWith("0x") || /^\d+$/.test(chainId)) {
      return chainId;
    }
    return shortString.encodeShortString(chainId);
  }

  private unwrapResults<T>(data: unknown): T[] {
    if (Array.isArray(data)) return data as T[];
    if (data && typeof data === "object") {
      const results = (data as ParadexResults<T>).results;
      if (Array.isArray(results)) return results;
    }
    return [];
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.jwtToken || (this.starknetAddress && this.starknetPrivateKey)) {
      const jwt = await this.getValidJwt();
      headers["Authorization"] = `Bearer ${jwt}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Paradex API error: ${response.status} - ${error}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private async getValidJwt(): Promise<string> {
    if (this.jwtToken && Date.now() < this.jwtExpiresAt) {
      return this.jwtToken;
    }

    if (!this.starknetAddress || !this.starknetPrivateKey) {
      throw new Error("Starknet credentials required to generate Paradex JWT");
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const expiration = timestamp + 1800; // 30 min signature expiry
    const chainId = this.normalizeChainId(await this.resolveChainId());

    // EIP-712-like TypedData for Paradex
    const typedDataPayload: TypedData = {
      domain: {
        name: "Paradex",
        chainId,
        version: "1",
      },
      primaryType: "Request",
      types: {
        StarkNetDomain: [
          { name: "name", type: "felt" },
          { name: "chainId", type: "felt" },
          { name: "version", type: "felt" },
        ],
        Request: [
          { name: "method", type: "felt" },
          { name: "path", type: "felt" },
          { name: "body", type: "felt" },
          { name: "timestamp", type: "felt" },
          { name: "expiration", type: "felt" },
        ],
      },
      message: {
        method: "POST",
        path: "/v1/auth",
        body: "",
        timestamp,
        expiration,
      },
    };

    // Correctly format message hash to hex before signing
    const messageHash = typedData.getMessageHash(typedDataPayload, this.starknetAddress);

    // Sign the hash
    const signature = ec.starkCurve.sign(messageHash, this.starknetPrivateKey);

    // Format the signature as a JSON string array of hex numbers as required by starknet
    // ec.sign returns { r, s }. We map it to an array of string values
    const signatureArray = typeof signature === 'object' && signature != null && 'r' in signature && 's' in signature ? [signature.r.toString(10), signature.s.toString(10)] : Array.isArray(signature) ? signature : [];

    const requestHeaders = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "PARADEX-STARKNET-ACCOUNT": this.starknetAddress,
      "PARADEX-STARKNET-SIGNATURE": JSON.stringify(signatureArray),
      "PARADEX-TIMESTAMP": String(timestamp),
      "PARADEX-SIGNATURE-EXPIRATION": String(expiration),
    };

    const url = `${this.baseUrl}/v1/auth`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    const response = await fetch(url, {
      method: "POST",
      headers: requestHeaders,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to authenticate with Paradex: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as { jwt_token: string };

    this.jwtToken = data.jwt_token;
    // JWTs are short-lived; refresh a bit early to avoid edge expirations.
    this.jwtExpiresAt = Date.now() + 3 * 60 * 1000;

    return this.jwtToken;
  }

  private async resolveChainId(): Promise<string> {
    if (this.chainId) {
      return this.chainId;
    }

    const config = await this.fetchSystemConfig();
    const chainId = this.extractChainId(config);

    if (!chainId) {
      throw new Error(
        "Paradex chainId not found in /v1/system/config. Set PARADEX_CHAIN_ID to override."
      );
    }

    this.chainId = chainId;
    return chainId;
  }

  private extractChainId(config: Record<string, unknown>): string | undefined {
    const directKeys = [
      "chainId",
      "chain_id",
      "starknet_chain_id",
      "starknetChainId",
    ];

    for (const key of directKeys) {
      const value = config[key as keyof typeof config];
      if (typeof value === "string" || typeof value === "number") {
        return String(value);
      }
    }

    const starknet = config.starknet;
    if (starknet && typeof starknet === "object") {
      const nested = starknet as Record<string, unknown>;
      for (const key of directKeys) {
        const value = nested[key];
        if (typeof value === "string" || typeof value === "number") {
          return String(value);
        }
      }
    }

    return undefined;
  }

  private async fetchSystemConfig(): Promise<Record<string, unknown>> {
    const url = `${this.baseUrl}/v1/system/config`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to fetch Paradex system config: ${response.status} - ${errorText}`
        );
      }

      return (await response.json()) as Record<string, unknown>;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private toQuantums(value: string, precision: number): string {
    const [whole, fraction = ""] = value.split(".");
    const sanitizedWhole = whole.replace(/^0+(?=\d)/, "") || "0";
    const paddedFraction = `${fraction}00000000000000000000`.slice(0, precision);
    const combined = `${sanitizedWhole}${paddedFraction}`.replace(/^0+(?=\d)/, "") || "0";
    return combined;
  }

  private signOrderPayload(
    chainId: string,
    order: ParadexCreateOrderRequest,
    timestamp: number
  ): string {
    if (!this.starknetAddress || !this.starknetPrivateKey) {
      throw new Error("Starknet credentials required to sign Paradex orders");
    }

    const sideForSigning = order.side === "BUY" ? "1" : "2";
    const priceForSigning = order.price ?? "0";
    const priceQuantums = this.toQuantums(priceForSigning, 8);
    const sizeQuantums = this.toQuantums(order.size, 8);
    const orderTypeFelt = shortString.encodeShortString(order.type);
    const marketFelt = shortString.encodeShortString(order.market);

    const typedDataPayload: TypedData = {
      domain: {
        name: "Paradex",
        chainId,
        version: "1",
      },
      primaryType: "Order",
      types: {
        StarkNetDomain: [
          { name: "name", type: "felt" },
          { name: "chainId", type: "felt" },
          { name: "version", type: "felt" },
        ],
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
        timestamp,
        market: marketFelt,
        side: sideForSigning,
        orderType: orderTypeFelt,
        size: sizeQuantums,
        price: priceQuantums,
      },
    };

    const messageHash = typedData.getMessageHash(
      typedDataPayload,
      this.starknetAddress
    );
    const signature = ec.starkCurve.sign(messageHash, this.starknetPrivateKey);
    const signatureArray =
      typeof signature === "object" &&
      signature != null &&
      "r" in signature &&
      "s" in signature
        ? [signature.r.toString(10), signature.s.toString(10)]
        : Array.isArray(signature)
          ? signature
          : [];
    return JSON.stringify(signatureArray);
  }

  // Market Data APIs

  async getMarkets(): Promise<ParadexMarket[]> {
    const data = await this.request<unknown>("/v1/markets");
    return this.unwrapResults<ParadexMarket>(data);
  }

  async getMarket(market: string): Promise<ParadexMarket> {
    return this.request<ParadexMarket>(`/v1/markets/${market}`);
  }

  async getOrderbook(market: string): Promise<ParadexOrderbook> {
    return this.request<ParadexOrderbook>(`/v1/orderbook/${market}`);
  }

  async getTicker(market: string): Promise<{
    market: string;
    price: string;
    indexPrice: string;
    oraclePrice: string;
    change24h: string;
    volume24h: string;
    fundingRate: string;
    nextFundingTime: string;
    openInterest: string;
  }> {
    return this.request(`/v1/ticker/${market}`);
  }

  private resolutionMap: Record<string, string> = {
    "1m": "1",
    "3m": "3",
    "5m": "5",
    "15m": "15",
    "30m": "30",
    "1h": "60",
  };

  private toParadexResolution(resolution: string): string {
    return this.resolutionMap[resolution] ?? resolution.replace(/[^0-9]/g, "");
  }

  async getCandles(
    market: string,
    resolution: string,
    from: number,
    to: number
  ): Promise<{
    market: string;
    resolution: string;
    candles: Array<{
      time: number;
      open: string;
      high: string;
      low: string;
      close: string;
      volume: string;
    }>;
  }> {
    const resolutionMinutes = this.toParadexResolution(resolution);
    const startAt = from * 1000;
    const endAt = to * 1000;
    const data = await this.request<{ results?: Array<[number, number, number, number, number, number]> }>(
      `/v1/markets/klines?symbol=${market}&resolution=${resolutionMinutes}&start_at=${startAt}&end_at=${endAt}&price_kind=last`
    );
    const rawCandles = Array.isArray(data?.results) ? data.results : (Array.isArray(data) ? data as Array<[number, number, number, number, number, number]> : []);
    const candles = rawCandles.map((k) => ({
      time: Math.floor(k[0] / 1000),
      open: String(k[1]),
      high: String(k[2]),
      low: String(k[3]),
      close: String(k[4]),
      volume: String(k[5]),
    }));
    return { market, resolution, candles };
  }

  // Trading APIs (require authentication)

  async getPositions(): Promise<ParadexPosition[]> {
    if (!this.starknetAddress) {
      throw new Error("API credentials required for positions");
    }
    const data = await this.request<unknown>("/v1/positions");
    return this.unwrapResults<ParadexPosition>(data);
  }

  async getPosition(market: string): Promise<ParadexPosition> {
    if (!this.starknetAddress) {
      throw new Error("API credentials required");
    }
    return this.request<ParadexPosition>(`/v1/positions/${market}`);
  }

  async getBalances(): Promise<ParadexBalance[]> {
    if (!this.starknetAddress) {
      throw new Error("API credentials required for balances");
    }
    const data = await this.request<unknown>("/v1/balances");
    return this.unwrapResults<ParadexBalance>(data);
  }

  async createOrder(request: ParadexCreateOrderRequest): Promise<ParadexOrder> {
    if (!this.starknetAddress) {
      throw new Error("API credentials required for trading");
    }

    if (
      (request.type === "LIMIT" || request.type === "STOP_LIMIT") &&
      !request.price
    ) {
      throw new Error("Price is required for limit orders");
    }

    if (
      (request.type === "STOP_LIMIT" || request.type === "STOP_MARKET") &&
      !request.stopPrice
    ) {
      throw new Error("stopPrice is required for stop orders");
    }

    const chainId = this.normalizeChainId(await this.resolveChainId());
    const signatureTimestamp = Date.now();
    const signature = this.signOrderPayload(chainId, request, signatureTimestamp);
    const instruction = request.postOnly
      ? "POST_ONLY"
      : request.timeInForce || "GTC";
    const payload = {
      market: request.market,
      side: request.side,
      type: request.type,
      size: request.size,
      price:
        request.price ??
        (request.type === "MARKET" || request.type === "STOP_MARKET" ? "0" : undefined),
      trigger_price: request.stopPrice,
      client_id: request.clientId,
      instruction,
      flags: request.reduceOnly ? ["REDUCE_ONLY"] : undefined,
      signature,
      signature_timestamp: signatureTimestamp,
    };

    return this.request<ParadexOrder>("/v1/orders", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getOrder(orderId: string): Promise<ParadexOrder> {
    if (!this.starknetAddress) {
      throw new Error("API credentials required");
    }
    return this.request<ParadexOrder>(`/v1/orders/${orderId}`);
  }

  async cancelOrder(orderId: string): Promise<{ success: boolean }> {
    if (!this.starknetAddress) {
      throw new Error("API credentials required");
    }
    return this.request<{ success: boolean }>(`/v1/orders/${orderId}`, {
      method: "DELETE",
    });
  }

  async cancelAllOrders(market?: string): Promise<{ canceled: number }> {
    if (!this.starknetAddress) {
      throw new Error("API credentials required");
    }
    const query = market ? `?market=${market}` : "";
    return this.request<{ canceled: number }>(`/v1/orders${query}`, {
      method: "DELETE",
    });
  }

  async getOpenOrders(market?: string): Promise<ParadexOrder[]> {
    if (!this.starknetAddress) {
      throw new Error("API credentials required");
    }
    const query = market ? `?market=${market}` : "";
    const data = await this.request<unknown>(`/v1/orders${query}`);
    return this.unwrapResults<ParadexOrder>(data);
  }

  async getOrderHistory(
    market?: string,
    limit = 100,
    cursor?: string
  ): Promise<{
    orders: ParadexOrder[];
    nextCursor?: string;
  }> {
    if (!this.starknetAddress) {
      throw new Error("API credentials required");
    }
    const query = new URLSearchParams();
    if (market) query.append("market", market);
    query.append("limit", limit.toString());
    if (cursor) query.append("cursor", cursor);
    const data = await this.request<unknown>(`/v1/orders/history?${query}`);
    return {
      orders: this.unwrapResults<ParadexOrder>(data),
      nextCursor: (data as { next?: string } | undefined)?.next,
    };
  }

  async getTrades(
    market?: string,
    limit = 100,
    cursor?: string
  ): Promise<{
    trades: ParadexTrade[];
    nextCursor?: string;
  }> {
    if (!this.starknetAddress) {
      throw new Error("API credentials required");
    }
    const query = new URLSearchParams();
    if (market) query.append("market", market);
    query.append("limit", limit.toString());
    if (cursor) query.append("cursor", cursor);
    const data = await this.request<unknown>(`/v1/trades?${query}`);
    return {
      trades: this.unwrapResults<ParadexTrade>(data),
      nextCursor: (data as { next?: string } | undefined)?.next,
    };
  }

  async getFundingPayments(
    market?: string,
    limit = 100
  ): Promise<{
    payments: Array<{
      market: string;
      payment: string;
      positionSize: string;
      fundingRate: string;
      time: string;
    }>;
  }> {
    if (!this.starknetAddress) {
      throw new Error("API credentials required");
    }
    const query = new URLSearchParams();
    if (market) query.append("market", market);
    query.append("limit", limit.toString());
    const data = await this.request<unknown>(`/v1/funding/payments?${query}`);
    return {
      payments: this.unwrapResults<{
        market: string;
        payment: string;
        positionSize: string;
        fundingRate: string;
        time: string;
      }>(data),
    };
  }

  // Account APIs

  async getAccount(): Promise<ParadexAccountInfo> {
    if (!this.starknetAddress) {
      throw new Error("API credentials required");
    }
    return this.request("/v1/account");
  }

  // Health check

  async healthCheck(): Promise<{ status: string; timestamp: number }> {
    return this.request<{ status: string; timestamp: number }>("/v1/health");
  }
}

// Factory function for creating Paradex client instances
export function createParadexClient(
  options: ParadexClientOptions
): ParadexClient {
  return new ParadexClient(options);
}
