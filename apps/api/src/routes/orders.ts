import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../config/env.js";
import { canUseMasterParadexClient } from "../authz/paradexAccess.js";
import { getAuthedUser, getParadexNetwork } from "./helpers.js";
import { getParadexClient } from "../dex/registry.js";
import { mapParadexOrder } from "../dex/mappers.js";
import { toParadexMarketSymbol } from "@hyperx/types/common";
import { createNotification, formatNotifAmount } from "../services/notifications.service.js";

import { getUserParadexClient } from "../dex/session.js";

const orderSchema = z.object({
  market: z.string(),
  side: z.union([z.literal("buy"), z.literal("sell")]),
  type: z.union([z.literal("market"), z.literal("limit"), z.literal("stop")]),
  size: z.string(),
  price: z.string().optional(),
  stopPrice: z.string().optional(),
  signature: z.string().optional(),
  signatureTimestamp: z.number().optional(),
  clientId: z.string().optional(),
});

export async function orderRoutes(app: FastifyInstance) {
  app.post("/api/orders", async (req, reply) => {
    const user = await getAuthedUser(req, reply);
    if (!user) return;

    const body = orderSchema.safeParse(req.body);
    if (!body.success) {
      reply.status(400);
      return { error: "invalid_order" };
    }

    const network = getParadexNetwork(req);
    const userClient = await getUserParadexClient(user.id, network);
    const masterAllowed = canUseMasterParadexClient(user.id, env);

    if (!userClient && !masterAllowed) {
      reply.status(403);
      return { error: "paradex_session_expired" };
    }

    const client = userClient ?? getParadexClient(network);

    if (!client) {
      reply.status(503);
      return {
        error: "order_failed",
        message: `Trading requires Paradex credentials for ${network}.`,
      };
    }

    try {
      const paradexType =
        body.data.type === "stop"
          ? body.data.price
            ? "STOP_LIMIT"
            : "STOP_MARKET"
          : body.data.type === "limit"
            ? "LIMIT"
            : "MARKET";

      const order = await client.createOrder({
        market: toParadexMarketSymbol(body.data.market),
        side: body.data.side === "buy" ? "BUY" : "SELL",
        type: paradexType,
        size: body.data.size,
        price: body.data.price,
        stopPrice: body.data.stopPrice,
        timeInForce: "GTC",
      });

      const id = (order as { id?: string }).id ?? `${body.data.market}-${Date.now()}`;
      try {
        await createNotification({
          userId: user.id,
          title: "Order Placed",
          message: `${body.data.side.toUpperCase()} ${formatNotifAmount(body.data.size)} ${body.data.market} @ ${body.data.price ? "$" + formatNotifAmount(body.data.price) : "Market"}`,
          type: "order",
          amount: body.data.size,
        });
      } catch {}

      return { id };
    } catch (error) {
      reply.status(500);
      return { error: "order_failed", message: (error as Error).message };
    }
  });

  app.delete("/api/orders/:id", async (req, reply) => {
    const user = await getAuthedUser(req, reply);
    if (!user) return;

    const idSchema = z.object({ id: z.string().min(1) });
    const params = idSchema.safeParse(req.params);
    if (!params.success) {
      reply.status(400);
      return { error: "invalid_order_id" };
    }

    const network = getParadexNetwork(req);
    const userClient = await getUserParadexClient(user.id, network);
    const masterAllowed = canUseMasterParadexClient(user.id, env);

    if (!userClient && !masterAllowed) {
      reply.status(503);
      return { error: "paradex_unavailable" };
    }

    const client = userClient ?? getParadexClient(network);

    if (!client) {
      reply.status(503);
      return { error: "paradex_unavailable" };
    }

    try {
      await client.cancelOrder(params.data.id);
      return { success: true };
    } catch (error) {
      reply.status(500);
      return { error: "cancel_failed", message: (error as Error).message };
    }
  });

  app.delete("/api/orders", async (req, reply) => {
    const user = await getAuthedUser(req, reply);
    if (!user) return;

    const network = getParadexNetwork(req);
    const userClient = await getUserParadexClient(user.id, network);
    const masterAllowed = canUseMasterParadexClient(user.id, env);

    if (!userClient && !masterAllowed) {
      reply.status(503);
      return { error: "paradex_unavailable" };
    }

    const market = (req.query as { market?: string }).market;
    const client = userClient ?? getParadexClient(network);

    if (!client) {
      reply.status(503);
      return { error: "paradex_unavailable" };
    }

    try {
      return await client.cancelAllOrders(
        market ? toParadexMarketSymbol(market) : undefined
      );
    } catch (error) {
      reply.status(500);
      return { error: "cancel_all_failed", message: (error as Error).message };
    }
  });

  app.get("/api/orders", async (req, reply) => {
    const user = await getAuthedUser(req, reply);
    if (!user) return;

    const network = getParadexNetwork(req);
    const userClient = await getUserParadexClient(user.id, network);
    const masterAllowed = canUseMasterParadexClient(user.id, env);

    if (!userClient && !masterAllowed) {
      return { orders: [] };
    }

    const market = (req.query as { market?: string }).market;
    const client = userClient ?? getParadexClient(network);

    if (client) {
      try {
        const raw = await client.getOpenOrders(
          market ? toParadexMarketSymbol(market) : undefined
        );
        const orders = raw.map((order) =>
          mapParadexOrder(order as unknown as Record<string, unknown>)
        );
        return { orders };
      } catch (error) {
        console.error("Failed to fetch Paradex orders:", error);
      }
    }

    return { orders: [] };
  });
}
