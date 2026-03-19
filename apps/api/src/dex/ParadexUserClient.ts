import type {
  ParadexOrder,
  ParadexPosition,
  ParadexBalance,
  ParadexAccount,
  ParadexCreateOrderRequest,
} from "@hyperx/types/dex";

export interface ParadexUserClientOptions {
  baseUrl: string;
  jwt: string;
  l2Account: string;
  timeout?: number;
}

type ParadexResults<T> = {
  results?: T[];
  next?: string;
  prev?: string;
};

export class ParadexUserClient {
  private baseUrl: string;
  private jwt: string;
  public readonly l2Account: string;
  private timeout: number;

  constructor(options: ParadexUserClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    if (this.baseUrl.endsWith("/v1")) {
      this.baseUrl = this.baseUrl.slice(0, -3);
    }
    this.jwt = options.jwt;
    this.l2Account = options.l2Account;
    this.timeout = options.timeout ?? 30000;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${this.jwt}`,
      ...((options.headers as Record<string, string>) || {}),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Paradex API error: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private unwrapResults<T>(data: unknown): T[] {
    if (Array.isArray(data)) return data as T[];
    if (data && typeof data === "object") {
      const results = (data as ParadexResults<T>).results;
      if (Array.isArray(results)) return results;
    }
    return [];
  }

  async getAccount(): Promise<ParadexAccount> {
    return this.request<ParadexAccount>("/v1/account");
  }

  async getBalances(): Promise<ParadexBalance[]> {
    const data = await this.request<unknown>("/v1/balance");
    return this.unwrapResults<ParadexBalance>(data);
  }

  async getPositions(): Promise<ParadexPosition[]> {
    const data = await this.request<unknown>("/v1/positions");
    return this.unwrapResults<ParadexPosition>(data);
  }

  async getOpenOrders(market?: string): Promise<ParadexOrder[]> {
    const params = new URLSearchParams();
    if (market) params.append("market", market);
    const queryString = params.toString() ? `?${params.toString()}` : "";
    const data = await this.request<unknown>(`/v1/orders${queryString}`);
    return this.unwrapResults<ParadexOrder>(data);
  }

  async createOrder(
    orderRequest: ParadexCreateOrderRequest & {
      signature?: string;
      signatureTimestamp?: number;
      clientId?: string;
    }
  ): Promise<ParadexOrder> {
    const payload: Record<string, unknown> = {
      market: orderRequest.market,
      side: orderRequest.side,
      type: orderRequest.type,
      size: orderRequest.size,
      time_in_force: orderRequest.timeInForce || "GTC",
    };

    if (orderRequest.price) payload.price = orderRequest.price;
    if (orderRequest.stopPrice) payload.trigger_price = orderRequest.stopPrice;
    if (orderRequest.clientId) payload.client_id = orderRequest.clientId;
    if (orderRequest.signature) payload.signature = orderRequest.signature;
    if (orderRequest.signatureTimestamp) {
      payload.signature_timestamp = orderRequest.signatureTimestamp;
    }

    return this.request<ParadexOrder>("/v1/orders", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async cancelOrder(orderId: string): Promise<void> {
    await this.request<void>(`/v1/orders/${orderId}`, {
      method: "DELETE",
    });
  }

  async cancelAllOrders(market?: string): Promise<{ canceled: string[] }> {
    const params = new URLSearchParams();
    if (market) params.append("market", market);
    const queryString = params.toString() ? `?${params.toString()}` : "";
    return this.request<{ canceled: string[] }>(`/v1/orders${queryString}`, {
      method: "DELETE",
    });
  }

  async getTrades(
    market?: string,
    limit = 100,
    cursor?: string
  ): Promise<{
    trades: any[];
    nextCursor?: string;
  }> {
    const query = new URLSearchParams();
    if (market) query.append("market", market);
    query.append("limit", limit.toString());
    if (cursor) query.append("cursor", cursor);
    const data = await this.request<unknown>(`/v1/trades?${query.toString()}`);
    return {
      trades: this.unwrapResults<any>(data),
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
    const query = new URLSearchParams();
    if (market) query.append("market", market);
    query.append("limit", limit.toString());
    const data = await this.request<unknown>(`/v1/funding/payments?${query.toString()}`);
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
}
