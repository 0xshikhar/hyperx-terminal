/**
 * Authentication Routes
 * 
 * Handles /auth/nonce and /auth/verify endpoints
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { generateNonce, authenticateUser } from "../services/auth.service.js";
import { env } from "../config/env.js";

const nonceRequestSchema = z.object({
  walletAddress: z.string().min(1),
});

const verifyRequestSchema = z.object({
  walletAddress: z.string().min(1),
  signature: z.array(z.string()),
  message: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /auth/nonce
   * Generate a nonce for wallet authentication
   */
  app.post("/auth/nonce", async (req, reply) => {
    const body = nonceRequestSchema.safeParse(req.body);
    if (!body.success) {
      reply.status(400);
      return { error: "invalid_request", message: "walletAddress is required" };
    }

    const { nonce, message } = generateNonce(body.data.walletAddress);

    return {
      nonce,
      message,
      expiresIn: 300, // 5 minutes in seconds
    };
  });

  /**
   * POST /auth/verify
   * Verify wallet signature and issue JWT token
   */
  app.post("/auth/verify", async (req, reply) => {
    const body = verifyRequestSchema.safeParse(req.body);
    if (!body.success) {
      reply.status(400);
      return {
        error: "invalid_request",
        message: "walletAddress, signature, and message are required",
      };
    }

    try {
      const authResult = await authenticateUser(
        body.data.walletAddress,
        body.data.signature,
        body.data.message
      );

      if (!authResult) {
        reply.status(401);
        return {
          error: "authentication_failed",
          message: "Invalid signature or expired nonce",
        };
      }

      // Generate JWT token
      const token = await reply.jwtSign(
        {
          userId: authResult.userId,
          walletAddress: authResult.walletAddress,
        },
        {
          expiresIn: env.JWT_EXPIRES_IN,
        }
      );

      // Set HTTP-only cookie
      reply.setCookie("token", token, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: "/",
      });

      return {
        token,
        user: {
          id: authResult.userId,
          walletAddress: authResult.walletAddress,
        },
      };
    } catch (error) {
      console.error("Auth verification error:", error);
      reply.status(500);
      return {
        error: "internal_error",
        message: "Authentication failed",
      };
    }
  });

  /**
   * POST /auth/refresh
   * Refresh JWT token
   */
  app.post("/auth/refresh", async (req, reply) => {
    try {
      // Verify current token
      const decoded = await req.jwtVerify<{ userId: string; walletAddress: string }>();

      // Generate new token
      const token = await reply.jwtSign(
        {
          userId: decoded.userId,
          walletAddress: decoded.walletAddress,
        },
        {
          expiresIn: env.JWT_EXPIRES_IN,
        }
      );

      // Update cookie
      reply.setCookie("token", token, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/",
      });

      return { token };
    } catch (error) {
      reply.status(401);
      return {
        error: "unauthorized",
        message: "Invalid or expired token",
      };
    }
  });

  /**
   * POST /auth/logout
   * Logout and clear cookie
   */
  app.post("/auth/logout", async (req, reply) => {
    reply.clearCookie("token", { path: "/" });
    return { success: true };
  });
}
