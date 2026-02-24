/**
 * WebSocket Authentication
 * 
 * Handles JWT authentication for WebSocket connections
 * Supports both initial connection auth and auth via message
 */

import jwt from "jsonwebtoken";

// JWT Secret (should match API server)
if (!process.env.JWT_SECRET) {
  console.warn("WARNING: JWT_SECRET not set. WebSocket auth will reject all tokens.");
}
const JWT_SECRET = process.env.JWT_SECRET || "";

export interface JWTPayload {
  userId: string;
  walletAddress: string;
  iat: number;
  exp: number;
}

/**
 * Extract token from WebSocket connection URL or message
 */
export function extractToken(url?: string, cookieHeader?: string): string | null {
  // Try URL query parameter
  if (url) {
    const urlObj = new URL(url, "ws://localhost");
    const token = urlObj.searchParams.get("token");
    if (token) return token;
  }

  // Try cookie header
  if (cookieHeader) {
    const match = cookieHeader.match(/token=([^;]+)/);
    if (match) return match[1];
  }

  return null;
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Authenticate connection
 */
export function authenticateConnection(
  url?: string,
  cookieHeader?: string
): { userId: string; walletAddress: string } | null {
  const token = extractToken(url, cookieHeader);
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  return {
    userId: payload.userId,
    walletAddress: payload.walletAddress,
  };
}

/**
 * Check if channel requires authentication
 */
export function requiresAuth(channel: string): boolean {
  return channel.startsWith("account:");
}

/**
 * Validate account channel access
 */
export function validateAccountChannel(
  channel: string,
  userId?: string
): boolean {
  if (!channel.startsWith("account:")) return true;
  if (!userId) return false;

  const channelUserId = channel.split(":")[1];
  return channelUserId === userId;
}
