/**
 * JWT Authentication Service
 * 
 * Handles Starknet wallet authentication using nonces and JWT tokens
 */

import { randomBytes } from "crypto";
import { RpcProvider, type Signature, type TypedData } from "starknet";
import { prisma } from "../db/client.js";
import { env } from "../config/env.js";

const NONCE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

const DEFAULT_STARKNET_RPC_URL =
  env.NODE_ENV === "production"
    ? "https://starknet-mainnet.public.blastapi.io/rpc/v0_7"
    : "https://starknet-sepolia.public.blastapi.io/rpc/v0_7";

const rpcProvider = new RpcProvider({
  nodeUrl: env.STARKNET_RPC_URL ?? DEFAULT_STARKNET_RPC_URL,
});

export interface JWTPayload {
  userId: string;
  walletAddress: string;
  tokenVersion: number;
  iat: number;
  exp: number;
}

export interface AuthRequest {
  walletAddress: string;
  signature: string[]; // Starknet signature format [r, s]
  message: string;
  chainId: string;
}

/**
 * Generate a cryptographically secure nonce for wallet authentication
 */
export async function generateNonce(walletAddress: string): Promise<{ nonce: string; message: string }> {
  // Use a felt-friendly nonce size (<= 31 bytes) so it can be signed in typed data.
  const nonce = randomBytes(31).toString("hex");
  const timestamp = Date.now();
  
  // Create a structured message following Starknet standards
  const message = `Sign this message to authenticate with HyperX Terminal\n\nWallet: ${walletAddress}\nNonce: ${nonce}\nTimestamp: ${timestamp}`;
  
  // Store nonce in the database so it can be consumed across instances.
  await prisma.authNonce.upsert({
    where: { walletAddress: walletAddress.toLowerCase() },
    update: {
      nonce,
      expiresAt: new Date(Date.now() + NONCE_EXPIRY_MS),
    },
    create: {
      walletAddress: walletAddress.toLowerCase(),
      nonce,
      expiresAt: new Date(Date.now() + NONCE_EXPIRY_MS),
    },
  });
  
  return { nonce, message };
}

/**
 * Verify that a nonce exists and hasn't expired
 */
export async function verifyNonce(walletAddress: string, expectedNonce: string): Promise<boolean> {
  const key = walletAddress.toLowerCase();

  const consumed = await prisma.authNonce.deleteMany({
    where: {
      walletAddress: key,
      nonce: expectedNonce,
      expiresAt: { gte: new Date() },
    },
  });

  return consumed.count > 0;
}

/**
 * Extract nonce from the signed message
 */
export function extractNonceFromMessage(message: string): string | null {
  const match = message.match(/Nonce: ([a-f0-9]{62,64})/);
  return match ? match[1] : null;
}

function extractTimestampFromMessage(message: string): number | null {
  const match = message.match(/Timestamp: (\d+)/);
  return match ? Number(match[1]) : null;
}

function buildAuthTypedData(
  walletAddress: string,
  nonce: string,
  timestamp: number,
  chainId: string
): TypedData {
  return {
    types: {
      StarkNetDomain: [
        { name: "name", type: "felt" },
        { name: "version", type: "felt" },
        { name: "chainId", type: "felt" },
      ],
      Auth: [
        { name: "wallet", type: "felt" },
        { name: "nonce", type: "felt" },
        { name: "timestamp", type: "felt" },
      ],
    },
    primaryType: "Auth",
    domain: {
      name: "HyperX",
      version: "1",
      chainId,
    },
    message: {
      wallet: walletAddress,
      nonce: `0x${nonce}`,
      timestamp: String(timestamp),
    },
  } as TypedData;
}

/**
 * Verify Starknet signature using starknet.js
 */
export async function verifyStarknetSignature(
  signature: string[],
  walletAddress: string,
  nonce: string,
  timestamp: number,
  chainId: string
): Promise<boolean> {
  try {
    // Validate signature format
    if (!signature || signature.length < 2) {
      console.error("Invalid signature format: expected at least 2 elements");
      return false;
    }

    // Parse signature components
    const r = signature[0];
    const s = signature[1];

    if (!r || !s) {
      console.error("Invalid signature: missing r or s");
      return false;
    }

    const typedData = buildAuthTypedData(walletAddress, nonce, timestamp, chainId);

    try {
      const isValid = await rpcProvider.verifyMessageInStarknet(
        typedData,
        signature as Signature,
        walletAddress
      );

      if (isValid) {
        console.log(`Signature verified successfully for wallet: ${walletAddress}`);
      } else {
        console.error(`Signature verification failed for wallet: ${walletAddress}`);
      }

      return isValid;
    } catch (error) {
      console.error("EC verification error:", error);
      return false;
    }
  } catch (error) {
    console.error("Signature verification failed:", error);
    return false;
  }
}

/**
 * Authenticate user with wallet signature
 */
export async function authenticateUser(
  walletAddress: string,
  signature: string[],
  message: string,
  chainId: string
): Promise<{ userId: string; walletAddress: string; tokenVersion: number } | null> {
  // Validate wallet address format
  if (!walletAddress || !walletAddress.startsWith("0x")) {
    console.error("Invalid wallet address format");
    return null;
  }

  // Extract and verify nonce
  const nonce = extractNonceFromMessage(message);
  if (!nonce) {
    console.error("No nonce found in message");
    return null;
  }

  const timestamp = extractTimestampFromMessage(message);
  if (!timestamp) {
    console.error("No timestamp found in message");
    return null;
  }

  if (!(await verifyNonce(walletAddress, nonce))) {
    console.error("Nonce verification failed");
    return null;
  }
  
  // Verify signature (strict in production by default)
  const isValid = await verifyStarknetSignature(signature, walletAddress, nonce, timestamp, chainId);
  const isStrict = env.AUTH_STRICT === "true" || env.NODE_ENV === "production";
  if (!isValid) {
    if (isStrict) {
      console.error("Signature verification failed");
      return null;
    }
    console.warn("Signature verification skipped (non-strict mode)");
  }
  
    // Get or create user
  const user = await prisma.user.upsert({
    where: { walletAddress: walletAddress.toLowerCase() },
    update: {},
    create: { 
      walletAddress: walletAddress.toLowerCase(),
    },
  });
  
  return {
    userId: user.id,
    walletAddress: user.walletAddress,
    tokenVersion: user.tokenVersion,
  };
}
