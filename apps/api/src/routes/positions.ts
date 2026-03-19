import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";
import { canUseMasterParadexClient } from "../authz/paradexAccess.js";
import { getAuthedUser, getParadexNetwork } from "./helpers.js";
import { getParadexClient } from "../dex/registry.js";
import { mapParadexPosition } from "../dex/mappers.js";

import { getUserParadexClient } from "../dex/session.js";

export async function positionRoutes(app: FastifyInstance) {
  app.get("/api/positions", async (req, reply) => {
    const user = await getAuthedUser(req, reply);
    if (!user) return;

    const network = getParadexNetwork(req);
    const userClient = await getUserParadexClient(user.id, network);
    const masterAllowed = canUseMasterParadexClient(user.id, env);

    if (!userClient && !masterAllowed) {
      return { positions: [] };
    }

    const client = userClient ?? getParadexClient(network);

    let positions: ReturnType<typeof mapParadexPosition>[] = [];
    if (client) {
      try {
        const raw = await client.getPositions();
        positions = raw
          .map((pos) => mapParadexPosition(pos as unknown as Record<string, unknown>))
          .sort((a, b) => b.openedAt.localeCompare(a.openedAt));
      } catch (error) {
        console.error("Failed to fetch Paradex positions:", error);
      }
    }

    return { positions };
  });
}
