import { prisma } from "../db/client.js";
import { ParadexUserClient } from "./ParadexUserClient.js";
import { resolveParadexUrl } from "./registry.js";
import type { ParadexNetwork } from "@hyperx/types/common";

export function normalizeAddress(addr: string): string {
  const clean = addr.toLowerCase().trim();
  if (clean.startsWith("0x")) {
    return "0x" + clean.slice(2).replace(/^0+/, "") || "0x0";
  }
  return clean;
}

export async function getUserParadexClient(
  userId: string,
  network: ParadexNetwork
): Promise<ParadexUserClient | null> {
  if (!prisma.paradexSession) {
    return null;
  }

  const session = await prisma.paradexSession.findUnique({
    where: {
      userId_network: {
        userId,
        network,
      },
    },
  });

  if (!session || !session.jwtEncrypted) {
    return null;
  }

  return new ParadexUserClient({
    baseUrl: resolveParadexUrl(network),
    jwt: session.jwtEncrypted,
    l2Account: session.l2Account,
  });
}
