import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../config/env.js";
import { canUseMasterParadexClient } from "../authz/paradexAccess.js";
import { getAuthedUser, getParadexNetwork } from "./helpers.js";
import {
  orderRouter,
  dexClients,
  paradexClients,
  paradexMarketClients,
  paradexOnboardingStatus,
  getParadexClient,
  isCorePerpMarket,
} from "../dex/registry.js";
import { normalizeDexMarket } from "../dex/mappers.js";
import { prisma } from "../db/client.js";
import { ParadexClient, ExtendedClient, ParadexUserClient } from "../dex/index.js";
import { resolveParadexUrl } from "../dex/registry.js";
import { normalizeAddress } from "../dex/session.js";
import type { RouteRequest } from "@hyperx/types/dex";
import type { ParadexNetwork } from "@hyperx/types/common";

const sessionBindSchema = z.object({
  jwt: z.string().min(1),
  l2Account: z.string().min(1),
  network: z.enum(["testnet", "mainnet"]).default("testnet"),
});

const authRelaySchema = z.object({
  l2Account: z.string().min(1),
  network: z.enum(["testnet", "mainnet"]).default("testnet"),
  headers: z.record(z.string()),
  body: z.record(z.unknown()).optional(),
});

const dexOrderSchema = z.object({
  market: z.string(),
  side: z.enum(["buy", "sell"]),
  type: z.enum(["market", "limit", "stop", "stop_limit"]),
  size: z.number().positive(),
  price: z.number().optional(),
  preferredExchange: z.string().optional(),
});

export async function dexRoutes(app: FastifyInstance) {
  app.get("/api/dex/markets", async (_req) => {
    const exchanges = orderRouter.getExchanges();
    const allMarkets = [];

    for (const exchangeName of exchanges) {
      try {
        const client = dexClients.get(exchangeName);
        if (client instanceof ParadexClient) {
          const markets = await client.getMarkets();
          const raw = markets as unknown as Record<string, unknown>[];
          const filtered = raw.filter((m) => isCorePerpMarket(m));
          allMarkets.push({
            exchange: exchangeName,
            markets: filtered.map((market) => normalizeDexMarket(exchangeName, market)),
          });
          continue;
        }
        if (client instanceof ExtendedClient) {
          const markets = await client.getMarkets();
          allMarkets.push({
            exchange: exchangeName,
            markets: markets.map((market) => normalizeDexMarket(exchangeName, market)),
          });
          continue;
        }
        allMarkets.push({
          exchange: exchangeName,
          markets: [],
        });
      } catch (error) {
        console.error(`Failed to fetch markets from ${exchangeName}:`, error);
      }
    }

    for (const [network, marketClient] of paradexMarketClients.entries()) {
      const exchangeName = `paradex-${network}`;
      if (!exchanges.includes(exchangeName) && marketClient) {
        try {
          const markets = await marketClient.getMarkets();
          const raw = markets as unknown as Record<string, unknown>[];
          const filtered = raw.filter((m) => isCorePerpMarket(m));
          allMarkets.push({
            exchange: exchangeName,
            markets: filtered.map((market) => normalizeDexMarket(exchangeName, market)),
          });
        } catch (error) {
          console.error(`Failed to fetch public Paradex markets for ${network}:`, error);
        }
      }
    }

    return { exchanges, markets: allMarkets };
  });

  app.get("/api/dex/paradex/account", async (req, reply) => {
    const user = await getAuthedUser(req, reply);
    if (!user) return;

    if (!canUseMasterParadexClient(user.id, env)) {
      return { account: null };
    }

    const network = getParadexNetwork(req);
    const client = getParadexClient(network);
    if (!client) {
      reply.status(400);
      return { error: "paradex_not_configured" };
    }

    try {
      const account = await client.getAccount();
      return { account };
    } catch (error) {
      reply.status(500);
      return { error: "paradex_account_failed", message: (error as Error).message };
    }
  });

  app.get("/api/dex/paradex/balances", async (req, reply) => {
    const user = await getAuthedUser(req, reply);
    if (!user) return;

    if (!canUseMasterParadexClient(user.id, env)) {
      return { balances: [] };
    }

    const network = getParadexNetwork(req);
    const client = getParadexClient(network);
    if (!client) {
      reply.status(400);
      return { error: "paradex_not_configured" };
    }

    try {
      const balances = await client.getBalances();
      return { balances };
    } catch (error) {
      reply.status(500);
      return { error: "paradex_balances_failed", message: (error as Error).message };
    }
  });

  app.get("/api/dex/paradex/onboarding-status", async (req, reply) => {
    const user = await getAuthedUser(req, reply);
    if (!user) return;

    if (!canUseMasterParadexClient(user.id, env)) {
      const network = getParadexNetwork(req);
      return { network, checked: true, onboarded: false };
    }

    const network = getParadexNetwork(req);
    const status = paradexOnboardingStatus.get(network);
    if (!status) return { network, checked: false, onboarded: false };
    return { network, ...status };
  });

  app.post("/api/dex/orders/route", async (req, reply) => {
    const user = await getAuthedUser(req, reply);
    if (!user) return;

    const body = dexOrderSchema.safeParse(req.body);
    if (!body.success) {
      reply.status(400);
      return { error: "invalid_order" };
    }

    if (!canUseMasterParadexClient(user.id, env)) {
      reply.status(403);
      return { error: "paradex_session_expired" };
    }

    try {
      const routeRequest: RouteRequest = {
        market: body.data.market,
        side: body.data.side,
        type: body.data.type,
        size: body.data.size,
        price: body.data.price,
        preferredExchange: body.data.preferredExchange,
        allowSplit: true,
      };

      const route = await orderRouter.getRouteDecision(routeRequest);
      return { route };
    } catch (error) {
      reply.status(500);
      return { error: "routing_failed", message: (error as Error).message };
    }
  });

  app.get("/api/dex/health", async () => {
    const health = await orderRouter.healthCheck();
    return { exchanges: health };
  });

  app.post("/api/dex/paradex/session", async (req, reply) => {
    const user = await getAuthedUser(req, reply);
    if (!user) return;

    const body = sessionBindSchema.safeParse(req.body);
    if (!body.success) {
      reply.status(400);
      return { error: "invalid_session_payload", details: body.error.flatten() };
    }

    const { jwt, l2Account, network } = body.data;
    const client = new ParadexUserClient({
      baseUrl: resolveParadexUrl(network as ParadexNetwork),
      jwt,
      l2Account,
    });

    let account;
    try {
      account = await client.getAccount();
    } catch (error) {
      reply.status(403);
      return { error: "paradex_jwt_invalid", message: (error as Error).message };
    }

    const accountAddress = (account.account ?? account.address ?? "") as string;
    if (accountAddress && normalizeAddress(accountAddress) !== normalizeAddress(l2Account)) {
      reply.status(403);
      return { error: "paradex_jwt_mismatch" };
    }

    // Check if l2Account is already bound to another user on the same network
    const existing = await prisma.paradexSession.findFirst({
      where: {
        network,
        l2Account,
        userId: { not: user.id },
      },
    });

    if (existing) {
      reply.status(409);
      return { error: "paradex_account_bound" };
    }

    await prisma.paradexSession.upsert({
      where: {
        userId_network: {
          userId: user.id,
          network,
        },
      },
      update: {
        l2Account,
        jwtEncrypted: jwt,
        onboarded: true,
      },
      create: {
        userId: user.id,
        network,
        l2Account,
        jwtEncrypted: jwt,
        onboarded: true,
      },
    });

    return { l2Account, network, onboarded: true };
  });

  app.get("/api/dex/paradex/session", async (req, reply) => {
    const user = await getAuthedUser(req, reply);
    if (!user) return;

    const network = getParadexNetwork(req);
    const session = await prisma.paradexSession.findUnique({
      where: {
        userId_network: {
          userId: user.id,
          network,
        },
      },
    });

    if (!session) {
      return { session: null };
    }

    return {
      session: {
        l2Account: session.l2Account,
        network: session.network,
        onboarded: session.onboarded,
        hasJwt: Boolean(session.jwtEncrypted),
        createdAt: session.createdAt.toISOString(),
      },
    };
  });

  app.delete("/api/dex/paradex/session", async (req, reply) => {
    const user = await getAuthedUser(req, reply);
    if (!user) return;

    const network = getParadexNetwork(req);
    await prisma.paradexSession.deleteMany({
      where: {
        userId: user.id,
        network,
      },
    });

    return { success: true };
  });

  app.post("/api/dex/paradex/auth", async (req, reply) => {
    const user = await getAuthedUser(req, reply);
    if (!user) return;

    const body = authRelaySchema.safeParse(req.body);
    if (!body.success) {
      reply.status(400);
      return { error: "invalid_auth_payload", details: body.error.flatten() };
    }

    const { l2Account, network, headers, body: reqBody } = body.data;
    const baseUrl = resolveParadexUrl(network as ParadexNetwork);

    try {
      const resp = await fetch(`${baseUrl}/v1/auth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...headers,
        },
        body: JSON.stringify(reqBody ?? {}),
      });

      if (!resp.ok) {
        const errorText = await resp.text();
        reply.status(resp.status);
        return { error: "paradex_auth_failed", details: errorText };
      }

      const authData = (await resp.json()) as { jwt_token?: string };
      const jwt = authData.jwt_token;

      if (!jwt) {
        reply.status(502);
        return { error: "paradex_jwt_missing" };
      }

      // Upsert session
      await prisma.paradexSession.upsert({
        where: {
          userId_network: {
            userId: user.id,
            network,
          },
        },
        update: {
          l2Account,
          jwtEncrypted: jwt,
          onboarded: true,
        },
        create: {
          userId: user.id,
          network,
          l2Account,
          jwtEncrypted: jwt,
          onboarded: true,
        },
      });

      return { jwt, l2Account, network, onboarded: true };
    } catch (error) {
      reply.status(500);
      return { error: "paradex_relay_failed", message: (error as Error).message };
    }
  });
}
