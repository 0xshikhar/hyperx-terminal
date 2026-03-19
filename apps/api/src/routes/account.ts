import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../config/env.js";
import { isTruthyFlag } from "../config/productionGuards.js";
import { prisma } from "../db/client.js";
import { DEMO_ACCOUNT, isDemoWallet } from "../demoWallet.js";
import { canUseMasterParadexClient } from "../authz/paradexAccess.js";
import { getAuthedUser, getParadexNetwork } from "./helpers.js";
import { getParadexClient } from "../dex/registry.js";
import { mapParadexPosition } from "../dex/mappers.js";
import { getUserParadexClient } from "../dex/session.js";
import type { ParadexAccount } from "@hyperx/types/dex";

function extractAccountSummary(
  account: ParadexAccount | null,
  positions: Array<{ entryPrice: number; size: number; margin: number; pnl: number }>
) {
  if (account) {
    const parseNum = (v: unknown): number => {
      if (typeof v === "number") return v;
      if (typeof v === "string") {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
      }
      return 0;
    };

    const accountValue = parseNum(account.accountValue ?? account.account_value ?? account.equity);
    const marginUsed = parseNum(
      account.marginUsed ??
        account.margin_used ??
        (account.accountValue != null ? undefined : positions.reduce((t, p) => t + p.margin, 0))
    );
    const unrealizedPnl = parseNum(
      account.unrealizedPnl ?? account.unrealized_pnl ?? account.unrealizedPnlUsd
    );

    if (accountValue > 0) {
      const finalMarginUsed =
        marginUsed > 0 ? marginUsed : positions.reduce((t, p) => t + p.margin, 0);
      return {
        balance: accountValue,
        available: Math.max(accountValue - finalMarginUsed, 0),
        marginUsed: finalMarginUsed,
        unrealizedPnl: unrealizedPnl || positions.reduce((t, p) => t + p.pnl, 0),
      };
    }
  }

  const marginUsed = positions.reduce((total, position) => total + position.margin, 0);
  const unrealizedPnl = positions.reduce((total, position) => total + position.pnl, 0);
  const notionalExposure = positions.reduce(
    (total, position) => total + position.entryPrice * position.size,
    0
  );
  const balance = notionalExposure;
  const available = Math.max(balance - marginUsed, 0);

  return {
    balance,
    available,
    marginUsed,
    unrealizedPnl,
  };
}

const EMPTY_ACCOUNT = {
  balance: 0,
  available: 0,
  marginUsed: 0,
  unrealizedPnl: 0,
};

const preferencesSchema = z.object({
  theme: z.string().optional(),
  defaultLeverage: z.number().int().min(1).max(100).optional(),
  defaultMarket: z.string().optional(),
  favoriteMarkets: z.array(z.string()).optional(),
});

export async function accountRoutes(app: FastifyInstance) {
  app.get("/api/me", async (req, reply) => {
    const user = await getAuthedUser(req, reply);
    if (!user) return;

    return {
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
        preferences: user.preferences
          ? {
              theme: user.preferences.theme,
              defaultLeverage: user.preferences.defaultLeverage,
              defaultMarket: user.preferences.defaultMarket,
              favoriteMarkets: user.preferences.favoriteMarkets,
            }
          : null,
      },
    };
  });

  app.get("/api/account", async (req, reply) => {
    const user = await getAuthedUser(req, reply);
    if (!user) return;

    if (isTruthyFlag(env.DEMO_MODE) && isDemoWallet(user.walletAddress)) {
      return { account: DEMO_ACCOUNT, demo: true };
    }

    const network = getParadexNetwork(req);
    const userClient = await getUserParadexClient(user.id, network);
    const masterAllowed = canUseMasterParadexClient(user.id, env);

    if (!userClient && !masterAllowed) {
      return { account: EMPTY_ACCOUNT };
    }

    const client = userClient ?? getParadexClient(network);

    let account: ParadexAccount | null = null;
    let positions: Array<{ entryPrice: number; size: number; margin: number; pnl: number }> = [];

    if (client) {
      try {
        account = await client.getAccount();
      } catch (error) {
        console.error("Failed to fetch Paradex account:", error);
      }

      try {
        const raw = await client.getPositions();
        positions = raw
          .map((pos) => mapParadexPosition(pos as unknown as Record<string, unknown>))
          .sort((a, b) => b.openedAt.localeCompare(a.openedAt));
      } catch (error) {
        console.error("Failed to fetch Paradex positions:", error);
      }
    }

    return {
      account: extractAccountSummary(account, positions),
    };
  });

  app.get("/api/leaderboard", async () => {
    return {
      leaderboard: [],
      leadersCount: 0,
      avgWinRate: "—",
      bestPnL: "—",
      performanceShape: "—",
      executionStyle: "—",
    };
  });

  app.put("/api/preferences", async (req, reply) => {
    const user = await getAuthedUser(req, reply);
    if (!user) return;

    const body = preferencesSchema.safeParse(req.body);
    if (!body.success) {
      reply.status(400);
      return { error: "invalid_preferences" };
    }

    const prefs = await prisma.userPreferences.upsert({
      where: { userId: user.id },
      update: body.data,
      create: {
        userId: user.id,
        theme: body.data.theme ?? "dark",
        defaultLeverage: body.data.defaultLeverage ?? 10,
        defaultMarket: body.data.defaultMarket ?? "BTC-USD",
        favoriteMarkets: body.data.favoriteMarkets ?? [],
      },
    });

    return {
      preferences: {
        theme: prefs.theme,
        defaultLeverage: prefs.defaultLeverage,
        defaultMarket: prefs.defaultMarket,
        favoriteMarkets: prefs.favoriteMarkets,
      },
    };
  });
}
