import { isTruthyFlag } from "../config/productionGuards.js";

export type ParadexAccessEnv = {
  NODE_ENV?: string;
  DEMO_MODE?: string;
  DEMO_ALLOW_TRADES?: string;
};

/**
 * Operator-key trading is legal only for local demo. Production boots refuse these flags.
 */
export function demoTradesAllowed(env: ParadexAccessEnv): boolean {
  return (
    env.NODE_ENV !== "production" &&
    isTruthyFlag(env.DEMO_MODE) &&
    isTruthyFlag(env.DEMO_ALLOW_TRADES)
  );
}

/**
 * PR-06a adds Prisma `ParadexSession`. Until that table exists, no HyperX user has a
 * bound per-user Paradex L2 session. Do not invent a fallback to the master client.
 */
export function hasParadexUserSession(_userId: string): boolean {
  return false;
}

export function canUseMasterParadexClient(userId: string, env: ParadexAccessEnv): boolean {
  return hasParadexUserSession(userId) || demoTradesAllowed(env);
}
