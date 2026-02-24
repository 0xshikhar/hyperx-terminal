/**
 * Extended DEX Client
 * 
 * Client for interacting with Extended DEX API
 * Supports spot and perpetual trading operations
 */

import type {
  DEXConfig,
  ExtendedMarket,
  ExtendedOrderbook,
  ExtendedOrder,
  ExtendedTrade,
  ExtendedAccountInfo,
  ExtendedCreateOrderRequest,
} from "@hyperx/types/dex";

export interface ExtendedClientOptions extends DEXConfig {
  credentials?: {
    apiKey: string;
    apiSecret: string;
  };
}

export class ExtendedClient {
  private baseUrl: string;
  private apiKey?: string;
  private apiSecret?: string;
  private timeout: number;

  constructor(options: ExtendedClientOptions) {
    this.baseUrl = options.baseUrl;
    this.apiKey = options.credentials?.apiKey;
    this.apiSecret = options.credentials?.apiSecret;
    this.timeout = options.timeout || 30000;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.apiKey) {
      headers["X-API-Key"] = this.apiKey;
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
        throw new Error(`Extended API error: ${response.status} - ${error}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  // Market Data APIs

  async getMarkets(): Promise<ExtendedMarket[]> {
    return this.request<ExtendedMarket[]>("/v1/markets");
  }

  async getMarket(symbol: string): Promise<ExtendedMarket> {
    return this.request<ExtendedMarket>(`/v1/markets/${symbol}`);
  }

  async getOrderbook(symbol: string, limit = 100): Promise<ExtendedOrderbook> {
    return this.request<ExtendedOrderbook>(
      `/v1/orderbook?symbol=${symbol}&limit=${limit}`
    );
  }

  async getTicker(symbol: string): Promise<{
    symbol: string;
    price: string;
    change24h: string;
    volume24h: string;
    high24h: string;
    low24h: string;
  }> {
    return this.request(`/v1/ticker/${symbol}`);
  }

  // Trading APIs (require authentication)

  async getAccount(): Promise<ExtendedAccountInfo> {
    if (!this.apiKey) {
      throw new Error("API credentials required for account operations");
    }
    return this.request<ExtendedAccountInfo>("/v1/account");
  }

  async createOrder(
    request: ExtendedCreateOrderRequest
  ): Promise<ExtendedOrder> {
    if (!this.apiKey) {
      throw new Error("API credentials required for trading");
    }
    return this.request<ExtendedOrder>("/v1/orders", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async getOrder(orderId: string): Promise<ExtendedOrder> {
    if (!this.apiKey) {
      throw new Error("API credentials required");
    }
    return this.request<ExtendedOrder>(`/v1/orders/${orderId}`);
  }

  async cancelOrder(orderId: string): Promise<{ success: boolean }> {
    if (!this.apiKey) {
      throw new Error("API credentials required");
    }
    return this.request<{ success: boolean }>(`/v1/orders/${orderId}`, {
      method: "DELETE",
    });
  }

  async getOpenOrders(symbol?: string): Promise<ExtendedOrder[]> {
    if (!this.apiKey) {
      throw new Error("API credentials required");
    }
    const query = symbol ? `?symbol=${symbol}` : "";
    return this.request<ExtendedOrder[]>(`/v1/orders${query}`);
  }

  async getOrderHistory(
    symbol?: string,
    limit = 100
  ): Promise<ExtendedOrder[]> {
    if (!this.apiKey) {
      throw new Error("API credentials required");
    }
    const query = new URLSearchParams();
    if (symbol) query.append("symbol", symbol);
    query.append("limit", limit.toString());
    return this.request<ExtendedOrder[]>(`/v1/orders/history?${query}`);
  }

  async getTrades(
    symbol?: string,
    limit = 100
  ): Promise<ExtendedTrade[]> {
    if (!this.apiKey) {
      throw new Error("API credentials required");
    }
    const query = new URLSearchParams();
    if (symbol) query.append("symbol", symbol);
    query.append("limit", limit.toString());
    return this.request<ExtendedTrade[]>(`/v1/trades?${query}`);
  }

  // Health check

  async healthCheck(): Promise<{ status: string; timestamp: number }> {
    return this.request<{ status: string; timestamp: number }>("/v1/health");
  }
}

// Factory function for creating Extended client instances
export function createExtendedClient(
  options: ExtendedClientOptions
): ExtendedClient {
  return new ExtendedClient(options);
}
