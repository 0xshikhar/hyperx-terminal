import type { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../db/client.js";
import type { ParadexNetwork } from "@hyperx/types/common";

export function extractToken(req: FastifyRequest): string | null {
  const cookieToken = req.cookies?.token;
  if (cookieToken) return cookieToken;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);
  return null;
}

export function getParadexNetwork(req: FastifyRequest): ParadexNetwork {
  const network = (req.headers as Record<string, string>)["x-paradex-network"];
  if (network === "mainnet") return "mainnet";
  return "testnet";
}

export interface AuthedUser {
  id: string;
  tokenVersion: number;
  walletAddress: string;
  username: string | null;
  email: string | null;
  createdAt: Date;
  preferences: {
    theme: string;
    defaultLeverage: number;
    defaultMarket: string;
    favoriteMarkets: string[];
  } | null;
}

export async function getAuthedUser(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<AuthedUser | null> {
  try {
    const token = extractToken(req);
    if (!token) {
      reply.status(401).send({ error: "Authentication required" });
      return null;
    }

    await req.jwtVerify();
    const payload = req.user as { userId: string; tokenVersion?: number } | undefined;
    if (!payload) {
      reply.status(401).send({ error: "Invalid or expired token" });
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        tokenVersion: true,
        id: true,
        walletAddress: true,
        username: true,
        email: true,
        createdAt: true,
        preferences: true,
      },
    });

    if (!user || user.tokenVersion !== payload.tokenVersion) {
      reply.status(401).send({ error: "Session expired" });
      return null;
    }

    return user;
  } catch {
    reply.status(401).send({ error: "Invalid or expired token" });
    return null;
  }
}
