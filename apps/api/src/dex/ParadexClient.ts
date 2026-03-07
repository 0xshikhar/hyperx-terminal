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
  OrderSide,
  OrderType,
} from "@hyperx/types/dex";

export interface ParadexClientOptions extends DEXConfig {
  credentials?: {
    apiKey: string;
    apiSecret: string;
  };
  starknetAddress?: string;
}

export class ParadexClient {
  private baseUrl: string;
  private apiKey?: string;
  private apiSecret?: string;
  private starknetAddress?: string;
  private timeout: number;

  constructor(options: ParadexClientOptions) {
    this.baseUrl = options.baseUrl;
    this.apiKey = options.credentials?.apiKey;
    this.apiSecret = options.credentials?.apiSecret;
    this.starknetAddress = options.starknetAddress;
    this.timeout = options.timeout || 30000;
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

    if (this.apiKey) {
      headers["PARADEX-API-KEY"] = this.apiKey;
    }

    if (this.starknetAddress) {
      headers["PARADEX-STARKNET-ADDRESS"] = this.starknetAddress;
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

  // Market Data APIs

  async getMarkets(): Promise<ParadexMarket[]> {
    return this.request<ParadexMarket[]>("/v1/markets");
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
    return this.request(
      `/v1/candles/${market}?resolution=${resolution}&from=${from}&to=${to}`
    );
  }

  // Trading APIs (require authentication)

  async getPositions(): Promise<ParadexPosition[]> {
    if (!this.apiKey) {
      throw new Error("API credentials required for positions");
    }
    return this.request<ParadexPosition[]>("/v1/positions");
  }

  async getPosition(market: string): Promise<ParadexPosition> {
    if (!this.apiKey) {
      throw new Error("API credentials required");
    }
    return this.request<ParadexPosition>(`/v1/positions/${market}`);
  }

  async getBalances(): Promise<ParadexBalance[]> {
    if (!this.apiKey) {
      throw new Error("API credentials required for balances");
    }
    return this.request<ParadexBalance[]>("/v1/balances");
  }

  async createOrder(request: ParadexCreateOrderRequest): Promise<ParadexOrder> {
    if (!this.apiKey) {
      throw new Error("API credentials required for trading");
    }
    return this.request<ParadexOrder>("/v1/orders", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async getOrder(orderId: string): Promise<ParadexOrder> {
    if (!this.apiKey) {
      throw new Error("API credentials required");
    }
    return this.request<ParadexOrder>(`/v1/orders/${orderId}`);
  }

  async cancelOrder(orderId: string): Promise<{ success: boolean }> {
    if (!this.apiKey) {
      throw new Error("API credentials required");
    }
    return this.request<{ success: boolean }>(`/v1/orders/${orderId}`, {
      method: "DELETE",
    });
  }

  async cancelAllOrders(market?: string): Promise<{ canceled: number }> {
    if (!this.apiKey) {
      throw new Error("API credentials required");
    }
    const query = market ? `?market=${market}` : "";
    return this.request<{ canceled: number }>(`/v1/orders${query}`, {
      method: "DELETE",
    });
  }

  async getOpenOrders(market?: string): Promise<ParadexOrder[]> {
    if (!this.apiKey) {
      throw new Error("API credentials required");
    }
    const query = market ? `?market=${market}` : "";
    return this.request<ParadexOrder[]>(`/v1/orders${query}`);
  }

  async getOrderHistory(
    market?: string,
    limit = 100,
    cursor?: string
  ): Promise<{
    orders: ParadexOrder[];
    nextCursor?: string;
  }> {
    if (!this.apiKey) {
      throw new Error("API credentials required");
    }
    const query = new URLSearchParams();
    if (market) query.append("market", market);
    query.append("limit", limit.toString());
    if (cursor) query.append("cursor", cursor);
    return this.request(`/v1/orders/history?${query}`);
  }

  async getTrades(
    market?: string,
    limit = 100,
    cursor?: string
  ): Promise<{
    trades: ParadexTrade[];
    nextCursor?: string;
  }> {
    if (!this.apiKey) {
      throw new Error("API credentials required");
    }
    const query = new URLSearchParams();
    if (market) query.append("market", market);
    query.append("limit", limit.toString());
    if (cursor) query.append("cursor", cursor);
    return this.request(`/v1/trades?${query}`);
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
    if (!this.apiKey) {
      throw new Error("API credentials required");
    }
    const query = new URLSearchParams();
    if (market) query.append("market", market);
    query.append("limit", limit.toString());
    return this.request(`/v1/funding/payments?${query}`);
  }

  // Account APIs

  async getAccount(): Promise<{
    starknetAddress: string;
    accountId: string;
    createdAt: string;
  }> {
    if (!this.apiKey) {
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
