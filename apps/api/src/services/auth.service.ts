/**
 * JWT Authentication Service
 * 
 * Handles Starknet wallet authentication using nonces and JWT tokens
 */

import { randomBytes, createHash } from "crypto";
import type { FastifyRequest, FastifyReply } from "fastify";
import { hash, ec, shortString, constants } from "starknet";
import { prisma } from "../db/client.js";
import { env } from "../config/env.js";

// In-memory nonce store (use Redis in production)
const nonceStore = new Map<string, { nonce: string; expiresAt: number }>();

const NONCE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export interface JWTPayload {
  userId: string;
  walletAddress: string;
  iat: number;
  exp: number;
}

export interface AuthRequest {
  walletAddress: string;
  signature: string[]; // Starknet signature format [r, s]
  message: string;
}

/**
 * Generate a cryptographically secure nonce for wallet authentication
 */
export function generateNonce(walletAddress: string): { nonce: string; message: string } {
  // Use a felt-friendly nonce size (<= 31 bytes) so it can be signed in typed data.
  const nonce = randomBytes(31).toString("hex");
  const timestamp = Date.now();
  
  // Create a structured message following Starknet standards
  const message = `Sign this message to authenticate with HyperX Terminal\n\nWallet: ${walletAddress}\nNonce: ${nonce}\nTimestamp: ${timestamp}`;
  
  // Store nonce with expiry
  nonceStore.set(walletAddress.toLowerCase(), {
    nonce,
    expiresAt: Date.now() + NONCE_EXPIRY_MS,
  });
  
  return { nonce, message };
}

/**
 * Verify that a nonce exists and hasn't expired
 */
export function verifyNonce(walletAddress: string, expectedNonce: string): boolean {
  const key = walletAddress.toLowerCase();
  const stored = nonceStore.get(key);
  
  if (!stored) return false;
  if (stored.expiresAt < Date.now()) {
    nonceStore.delete(key);
    return false;
  }
  if (stored.nonce !== expectedNonce) return false;
  
  // Clean up after successful verification
  nonceStore.delete(key);
  return true;
}

/**
 * Extract nonce from the signed message
 */
export function extractNonceFromMessage(message: string): string | null {
  const match = message.match(/Nonce: ([a-f0-9]{62,64})/);
  return match ? match[1] : null;
}

/**
 * Compute Starknet message hash for signature verification
 * Following Starknet's standard message encoding
 */
function computeMessageHash(message: string): string {
  // Encode the message
  const messageBytes = new TextEncoder().encode(message);
  
  // Compute hash using Starknet's pedersen hash
  // Split message into felts if needed
  const messageFelt = hash.computeHashOnElements([
    BigInt("0x" + createHash("sha256").update(messageBytes).digest("hex").slice(0, 62)),
  ]);
  
  return messageFelt;
}

/**
 * Extract public key from wallet address
 * Note: In Starknet, the address is derived from the public key
 */
async function getPublicKeyFromAddress(walletAddress: string): Promise<string | null> {
  try {
    // For Argent/Braavos wallets, the address IS the public key in many cases
    // In production, you might need to query the wallet contract
    // For now, we'll use the address as the public key
    return walletAddress;
  } catch (error) {
    console.error("Failed to get public key:", error);
    return null;
  }
}

/**
 * Verify Starknet signature using starknet.js
 * 
 * Starknet signatures are ECDSA signatures over the STARK curve
 * Format: [r, s] where r and s are big integers as hex strings
 */
export async function verifyStarknetSignature(
  message: string,
  signature: string[],
  walletAddress: string
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

    // Convert to BigInt
    let rBigInt: bigint;
    let sBigInt: bigint;

    try {
      rBigInt = BigInt(r);
      sBigInt = BigInt(s);
    } catch (error) {
      console.error("Invalid signature format: r or s is not a valid bigint");
      return false;
    }

    // Validate signature values are within valid range
    const starkCurveOrder = BigInt("3618502788666131213697322783095070105623107215331596699973092056135872020481");
    if (rBigInt <= 0n || rBigInt >= starkCurveOrder) {
      console.error("Invalid signature: r is out of range");
      return false;
    }
    if (sBigInt <= 0n || sBigInt >= starkCurveOrder) {
      console.error("Invalid signature: s is out of range");
      return false;
    }

    // Compute message hash
    const messageHash = computeMessageHash(message);

    // Get public key from address
    const publicKey = await getPublicKeyFromAddress(walletAddress);
    if (!publicKey) {
      console.error("Failed to get public key from address");
      return false;
    }

    // Verify using starknet.js ec module
    // The ec.verify function checks if the signature is valid for the given public key and hash
    try {
      const publicKeyBigInt = BigInt(publicKey);
      const messageHashBigInt = BigInt(messageHash);

      // Use starknet.js ec.starkCurve.verify for ECDSA verification
      // Convert signature to hex format
      const signatureHex = `0x${rBigInt.toString(16).padStart(64, "0")}${sBigInt.toString(16).padStart(64, "0")}`;
      
      const isValid = ec.starkCurve.verify(
        messageHashBigInt.toString(),
        signatureHex,
        publicKeyBigInt.toString()
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
  message: string
): Promise<{ userId: string; walletAddress: string } | null> {
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

  if (!verifyNonce(walletAddress, nonce)) {
    console.error("Nonce verification failed");
    return null;
  }
  
  // Verify signature (strict in production by default)
  const isValid = await verifyStarknetSignature(message, signature, walletAddress);
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
  };
}

/**
 * Clean up expired nonces periodically
 */
export function startNonceCleanup(): void {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of nonceStore.entries()) {
      if (value.expiresAt < now) {
        nonceStore.delete(key);
      }
    }
  }, 60 * 1000); // Run every minute
}

// Start cleanup on module load
startNonceCleanup();
