/**
 * Authentication Service
 * 
 * Handles Starknet wallet authentication with JWT tokens
 */

import { apiClient } from "./apiClient/client";
import { useWallet } from "@/components/wallet/useWallet";

interface AuthResponse {
  token: string;
  user: {
    id: string;
    walletAddress: string;
  };
}

interface NonceResponse {
  nonce: string;
  message: string;
  expiresIn: number;
}

const TOKEN_KEY = "hyperx-jwt-token";

/**
 * Get stored JWT token
 */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Store JWT token
 */
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Remove JWT token
 */
export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!getToken();
}

/**
 * Request nonce from backend
 */
export async function requestNonce(walletAddress: string): Promise<NonceResponse> {
  const response = await apiClient.post("/auth/nonce", { walletAddress });
  return response.data;
}

/**
 * Authenticate wallet with signature
 */
export async function authenticateWallet(
  walletAddress: string,
  signature: string[],
  message: string
): Promise<AuthResponse> {
  const response = await apiClient.post("/auth/verify", {
    walletAddress,
    signature,
    message,
  });
  
  // Store token
  setToken(response.data.token);
  
  return response.data;
}

/**
 * Refresh JWT token
 */
export async function refreshToken(): Promise<{ token: string }> {
  const response = await apiClient.post("/auth/refresh");
  setToken(response.data.token);
  return response.data;
}

/**
 * Logout user
 */
export async function logout(): Promise<void> {
  try {
    await apiClient.post("/auth/logout");
  } finally {
    removeToken();
  }
}

/**
 * Complete authentication flow
 * 1. Request nonce
 * 2. Sign message with wallet
 * 3. Verify signature and get JWT
 */
export async function signInWithWallet(): Promise<AuthResponse> {
  const { account, address, chainId: walletChainId } = useWallet.getState();
  
  if (!account || !address) {
    throw new Error("Wallet not connected");
  }

  // Step 1: Get nonce from backend
  const nonceResponse = await requestNonce(address);
  const { message } = nonceResponse;
  const { nonce: parsedNonce, timestamp } = extractAuthFields(message);
  const nonce = normalizeNonce(nonceResponse.nonce) ?? parsedNonce;
  if (!nonce) {
    throw new Error("Invalid auth message from server");
  }

  // Step 2: Sign message with Starknet wallet
  // Create typed data for proper signing
  const envNetwork = (import.meta.env.VITE_STARKNET_NETWORK ?? "sepolia").toLowerCase();
  const envChainId =
    envNetwork === "mainnet"
      ? "SN_MAIN"
      : "SN_SEPOLIA";
  const chainId = walletChainId ?? envChainId;

  const typedData = {
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
      wallet: address,
      nonce: `0x${nonce}`,
      timestamp: String(timestamp ?? Date.now()),
    },
  };
  
  const signature = await account.signMessage(typedData);
  const normalizedSignature = normalizeSignature(signature);

  // Step 3: Verify signature and get JWT
  const authResponse = await authenticateWallet(
    address,
    normalizedSignature,
    message
  );

  return authResponse;
}

function extractAuthFields(message: string): { nonce: string | null; timestamp: number | null } {
  const nonceMatch = message.match(/Nonce: ([a-f0-9]{62,64})/i);
  const tsMatch = message.match(/Timestamp: (\d+)/);
  return {
    nonce: nonceMatch ? nonceMatch[1] : null,
    timestamp: tsMatch ? Number(tsMatch[1]) : null,
  };
}

function normalizeNonce(nonce: string | null | undefined): string | null {
  if (!nonce) return null;
  const trimmed = nonce.trim().toLowerCase().replace(/^0x/, "");
  if (!/^[a-f0-9]{1,64}$/.test(trimmed)) return null;
  return trimmed;
}

function normalizeSignature(signature: unknown): string[] {
  if (Array.isArray(signature)) {
    return signature.map((value) => signatureValueToString(value));
  }

  if (signature && typeof signature === "object") {
    const maybeSignature = signature as { r?: unknown; s?: unknown };
    if (maybeSignature.r !== undefined && maybeSignature.s !== undefined) {
      return [signatureValueToString(maybeSignature.r), signatureValueToString(maybeSignature.s)];
    }
  }

  return [signatureValueToString(signature)];
}

function signatureValueToString(value: unknown): string {
  if (typeof value === "bigint") {
    return `0x${value.toString(16)}`;
  }
  if (typeof value === "number") {
    return `0x${value.toString(16)}`;
  }
  if (typeof value === "string") {
    return value;
  }
  return String(value);
}

/**
 * Initialize auth on app startup
 * Validates existing token and refreshes if needed
 */
export async function initAuth(): Promise<boolean> {
  const token = getToken();
  if (!token) return false;

  try {
    // Try to refresh token to validate it
    await refreshToken();
    return true;
  } catch {
    // Token invalid, remove it
    removeToken();
    return false;
  }
}
