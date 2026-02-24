/**
 * Authentication Middleware
 * 
 * Validates JWT tokens and attaches user info to requests
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../db/client.js";

export interface JWTPayload {
  userId: string;
  walletAddress: string;
  tokenVersion: number;
}

/**
 * Extract JWT token from request (cookie or Authorization header)
 */
function extractToken(req: FastifyRequest): string | null {
  // Try cookie first
  const cookieToken = req.cookies?.token;
  if (cookieToken) return cookieToken;
  
  // Try Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  
  return null;
}

/**
 * Middleware to require authentication
 */
export async function requireAuth(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<boolean> {
  const token = extractToken(req);
  
  if (!token) {
    reply.status(401).send({ error: "Authentication required" });
    return false;
  }
  
  try {
    // Verify JWT using Fastify's JWT plugin
    await req.jwtVerify();
    const payload = req.user as JWTPayload | undefined;
    if (!payload) {
      reply.status(401).send({ error: "Invalid or expired token" });
      return false;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { tokenVersion: true },
    });

    if (!user || user.tokenVersion !== payload.tokenVersion) {
      reply.status(401).send({ error: "Invalid or expired token" });
      return false;
    }

    return true;
  } catch {
    reply.status(401).send({ error: "Invalid or expired token" });
    return false;
  }
}

/**
 * Middleware to optionally authenticate (doesn't fail if no token)
 */
export async function optionalAuth(
  req: FastifyRequest,
  _reply: FastifyReply
): Promise<boolean> {
  const token = extractToken(req);
  
  if (!token) {
    return false;
  }
  
  try {
    await req.jwtVerify();
    const payload = req.user as JWTPayload | undefined;
    if (!payload) {
      return false;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { tokenVersion: true },
    });

    return Boolean(user && user.tokenVersion === payload.tokenVersion);
  } catch {
    // Silently fail - user not authenticated but request continues
    return false;
  }
}

/**
 * Get authenticated user from request
 */
export function getAuthUser(req: FastifyRequest): JWTPayload | null {
  const user = req.user as JWTPayload | undefined;
  return user || null;
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(req: FastifyRequest): boolean {
  return !!req.user;
}
