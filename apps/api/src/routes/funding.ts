import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";
import { canUseMasterParadexClient } from "../authz/paradexAccess.js";
import { getAuthedUser, getParadexNetwork } from "./helpers.js";
import { getParadexClient } from "../dex/registry.js";
import { mapParadexFunding } from "../dex/mappers.js";
import { toParadexMarketSymbol } from "@hyperx/types/common";

import { getUserParadexClient } from "../dex/session.js";

const PAGE_SIZE = 20;

export async function fundingRoutes(app: FastifyInstance) {
  app.get("/api/funding", async (req, reply) => {
    const user = await getAuthedUser(req, reply);
    if (!user) return;

    const network = getParadexNetwork(req);
    const userClient = await getUserParadexClient(user.id, network);
    const masterAllowed = canUseMasterParadexClient(user.id, env);

    if (!userClient && !masterAllowed) {
      return { items: [], total: 0 };
    }

    const client = userClient ?? getParadexClient(network);
    const { market } = (req.query || {}) as { market?: string };

    if (client) {
      try {
        const paradexMarket = market ? toParadexMarketSymbol(market) : undefined;
        const fundingResponse = await client.getFundingPayments(paradexMarket, PAGE_SIZE);
        const items = fundingResponse.payments.map((payment: any) =>
          mapParadexFunding(payment as unknown as Record<string, unknown>)
        );
        return { items, total: items.length };
      } catch (error) {
        console.error("Failed to fetch Paradex funding:", error);
      }
    }

    return { items: [], total: 0 };
  });
}
