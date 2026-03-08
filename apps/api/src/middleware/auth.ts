/**
 * Authentication Middleware
 * 
 * Validates JWT tokens and attaches user info to requests
 */

import type { FastifyRequest, FastifyReply } from "fastify";

export interface JWTPayload {
  userId: string;
  walletAddress: string;
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
): Promise<void> {
  const token = extractToken(req);
  
  if (!token) {
    reply.status(401);
    throw new Error("Authentication required");
  }
  
  try {
    // Verify JWT using Fastify's JWT plugin
    await req.jwtVerify();
  } catch (error) {
    reply.status(401);
    throw new Error("Invalid or expired token");
  }
}

/**
 * Middleware to optionally authenticate (doesn't fail if no token)
 */
export async function optionalAuth(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const token = extractToken(req);
  
  if (!token) {
    return;
  }
  
  try {
    await req.jwtVerify();
  } catch {
    // Silently fail - user not authenticated but request continues
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
