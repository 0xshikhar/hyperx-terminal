/**
 * Order Routing Service
 * 
 * Routes orders to the best available DEX based on:
 * - Price
 * - Liquidity
 * - Fees
 * - Slippage
 * - User preferences
 */

import type {
  RouteRequest,
  RouteResult,
  RouteLeg,
  OrderRouteDecision,
  OrderSide,
  OrderType,
} from "@hyperx/types/dex";
import { ExtendedClient } from "./ExtendedClient.js";
import { ParadexClient } from "./ParadexClient.js";

interface DEXRouteInfo {
  exchange: string;
  price: number;
  availableLiquidity: number;
  fee: number;
  latency: number;
}

export class OrderRouter {
  private exchanges: Map<string, ExtendedClient | ParadexClient> = new Map();
  private exchangeFees: Map<string, { maker: number; taker: number }> =
    new Map();

  constructor() {
    // Default fee structure (can be overridden)
    this.exchangeFees.set("extended", { maker: 0.001, taker: 0.001 });
    this.exchangeFees.set("paradex", { maker: 0.0002, taker: 0.0005 });
  }

  registerExchange(
    name: string,
    client: ExtendedClient | ParadexClient
  ): void {
    this.exchanges.set(name.toLowerCase(), client);
  }

  setExchangeFees(
    exchange: string,
    fees: { maker: number; taker: number }
  ): void {
    this.exchangeFees.set(exchange.toLowerCase(), fees);
  }

  private async getBestPrice(
    market: string,
    side: OrderSide,
    size: number
  ): Promise<DEXRouteInfo[]> {
    const routes: DEXRouteInfo[] = [];

    for (const [exchangeName, client] of this.exchanges.entries()) {
      try {
        const startTime = Date.now();
        let price = 0;
        let availableLiquidity = 0;

        if (client instanceof ExtendedClient) {
          const orderbook = await client.getOrderbook(market);
          const levels =
            side === "buy" ? orderbook.asks : orderbook.bids;
          
          // Calculate weighted average price for the order size
          let remainingSize = size;
          let totalCost = 0;
          
          for (const [levelPrice, levelSize] of levels) {
            const levelPriceNum = parseFloat(levelPrice);
            const levelSizeNum = parseFloat(levelSize);
            const takeSize = Math.min(remainingSize, levelSizeNum);
            
            totalCost += takeSize * levelPriceNum;
            remainingSize -= takeSize;
            availableLiquidity += levelSizeNum;
            
            if (remainingSize <= 0) break;
          }
          
          price = remainingSize > 0 ? 0 : totalCost / size;
        } else if (client instanceof ParadexClient) {
          const orderbook = await client.getOrderbook(market);
          const levels =
            side === "buy" ? orderbook.asks : orderbook.bids;
          
          let remainingSize = size;
          let totalCost = 0;
          
          for (const level of levels) {
            const levelPrice = parseFloat(level.price);
            const levelSize = parseFloat(level.size);
            const takeSize = Math.min(remainingSize, levelSize);
            
            totalCost += takeSize * levelPrice;
            remainingSize -= takeSize;
            availableLiquidity += levelSize;
            
            if (remainingSize <= 0) break;
          }
          
          price = remainingSize > 0 ? 0 : totalCost / size;
        }

        const latency = Date.now() - startTime;
        const fees = this.exchangeFees.get(exchangeName) || {
          maker: 0.001,
          taker: 0.001,
        };
        const fee = price * size * fees.taker;

        if (price > 0) {
          routes.push({
            exchange: exchangeName,
            price,
            availableLiquidity,
            fee,
            latency,
          });
        }
      } catch (error) {
        console.error(`Failed to get price from ${exchangeName}:`, error);
      }
    }

    // Sort by best price (lowest for buy, highest for sell)
    return routes.sort((a, b) => {
      if (side === "buy") {
        return a.price - b.price;
      } else {
        return b.price - a.price;
      }
    });
  }

  async routeOrder(request: RouteRequest): Promise<RouteResult> {
    const { market, side, size, preferredExchange, allowSplit = true } = request;

    // Get prices from all exchanges
    const routes = await this.getBestPrice(market, side, size);

    if (routes.length === 0) {
      throw new Error("No available liquidity for this order");
    }

    // If preferred exchange is specified, try to use it
    if (preferredExchange) {
      const preferred = routes.find(
        (r) => r.exchange === preferredExchange.toLowerCase()
      );
      if (preferred && preferred.availableLiquidity >= size) {
        const legs: RouteLeg[] = [
          {
            exchange: preferred.exchange,
            size,
            price: preferred.price,
            fee: preferred.fee,
            estimatedSlippage: 0,
          },
        ];

        return {
          requestId: this.generateRequestId(),
          market,
          side,
          totalSize: size,
          averagePrice: preferred.price,
          totalFee: preferred.fee,
          estimatedSlippage: 0,
          legs,
          bestExchange: preferred.exchange,
          timestamp: Date.now(),
        };
      }
    }

    // If split is not allowed, use the best single exchange
    if (!allowSplit) {
      const best = routes[0];
      const legs: RouteLeg[] = [
        {
          exchange: best.exchange,
          size: Math.min(size, best.availableLiquidity),
          price: best.price,
          fee: best.fee,
          estimatedSlippage: 0,
        },
      ];

      return {
        requestId: this.generateRequestId(),
        market,
        side,
        totalSize: legs[0].size,
        averagePrice: best.price,
        totalFee: best.fee,
        estimatedSlippage: 0,
        legs,
        bestExchange: best.exchange,
        timestamp: Date.now(),
      };
    }

    // Split order across multiple exchanges for best execution
    const legs: RouteLeg[] = [];
    let remainingSize = size;
    let totalCost = 0;
    let totalFee = 0;

    for (const route of routes) {
      if (remainingSize <= 0) break;

      const legSize = Math.min(remainingSize, route.availableLiquidity);
      const legCost = legSize * route.price;
      
      legs.push({
        exchange: route.exchange,
        size: legSize,
        price: route.price,
        fee: route.fee * (legSize / size), // Proportional fee
        estimatedSlippage: 0,
      });

      totalCost += legCost;
      totalFee += route.fee * (legSize / size);
      remainingSize -= legSize;
    }

    const executedSize = size - remainingSize;
    const averagePrice = executedSize > 0 ? totalCost / executedSize : 0;

    return {
      requestId: this.generateRequestId(),
      market,
      side,
      totalSize: executedSize,
      averagePrice,
      totalFee,
      estimatedSlippage: 0,
      legs,
      bestExchange: legs[0]?.exchange || routes[0].exchange,
      timestamp: Date.now(),
    };
  }

  async getRouteDecision(
    request: RouteRequest
  ): Promise<OrderRouteDecision> {
    const result = await this.routeOrder(request);

    return {
      requestId: result.requestId,
      primaryExchange: result.bestExchange,
      backupExchanges: result.legs.slice(1).map((leg) => leg.exchange),
      splitExecution: result.legs.length > 1,
      legs: result.legs,
      reasoning: this.generateReasoning(result),
    };
  }

  private generateReasoning(result: RouteResult): string {
    const parts: string[] = [];

    if (result.legs.length === 1) {
      parts.push(
        `Single exchange execution on ${result.bestExchange} for best price (${result.averagePrice})`
      );
    } else {
      parts.push(
        `Split execution across ${result.legs.length} exchanges for optimal fill`
      );
      parts.push(`Primary: ${result.legs[0].exchange} (${result.legs[0].size})`);
      for (let i = 1; i < result.legs.length; i++) {
        parts.push(`Backup ${i}: ${result.legs[i].exchange} (${result.legs[i].size})`);
      }
    }

    parts.push(`Average price: ${result.averagePrice}`);
    parts.push(`Total fee: ${result.totalFee}`);

    return parts.join("; ");
  }

  private generateRequestId(): string {
    return `route_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get all registered exchanges
  getExchanges(): string[] {
    return Array.from(this.exchanges.keys());
  }

  // Health check for all exchanges
  async healthCheck(): Promise<
    Array<{ exchange: string; healthy: boolean; latency: number }>
  > {
    const results: Array<{
      exchange: string;
      healthy: boolean;
      latency: number;
    }> = [];

    for (const [name, client] of this.exchanges.entries()) {
      const startTime = Date.now();
      try {
        await client.healthCheck();
        results.push({
          exchange: name,
          healthy: true,
          latency: Date.now() - startTime,
        });
      } catch {
        results.push({
          exchange: name,
          healthy: false,
          latency: Date.now() - startTime,
        });
      }
    }

    return results;
  }
}

// Singleton instance
let orderRouter: OrderRouter | null = null;

export function getOrderRouter(): OrderRouter {
  if (!orderRouter) {
    orderRouter = new OrderRouter();
  }
  return orderRouter;
}

export function resetOrderRouter(): void {
  orderRouter = null;
}
