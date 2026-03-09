import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

const envCandidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../../.env"),
  path.resolve(process.cwd(), "../.env"),
];

const envPath = envCandidates.find((candidate) => fs.existsSync(candidate));

if (envPath) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const envSchema = z.object({
  NODE_ENV: z.string().optional(),
  PORT: z.string().optional(),
  DATABASE_URL: z.string().min(1),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  // JWT Auth - optional for dev, but should be set in production
  JWT_SECRET: z.string().optional().default("dev-jwt-secret-change-in-production"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  COOKIE_SECRET: z.string().optional(),
  AUTH_STRICT: z.string().optional().default("false"),
  // Extended DEX
  EXTENDED_API_KEY: z.string().optional(),
  EXTENDED_API_SECRET: z.string().optional(),
  EXTENDED_API_URL: z.string().optional(),
  EXTENDED_CHAIN_ID: z.string().optional(),
  // Paradex DEX
  PARADEX_STARKNET_ADDRESS: z.string().optional(),
  PARADEX_STARKNET_PRIVATE_KEY: z.string().optional(),
  PARADEX_JWT_TOKEN: z.string().optional(),
  PARADEX_API_URL: z.string().optional(),
  PARADEX_REST_URL: z.string().optional(),
  PARADEX_WS_URL: z.string().optional(),
  PARADEX_CHAIN_ID: z.string().optional(),
});

const parsed = envSchema.parse(process.env);

// Warn if using default JWT_SECRET in production
if (parsed.JWT_SECRET === "dev-jwt-secret-change-in-production" && parsed.NODE_ENV === "production") {
  console.error("⚠️  WARNING: Using default JWT_SECRET in production! Set JWT_SECRET environment variable.");
  process.exit(1);
}

export const env = parsed;
