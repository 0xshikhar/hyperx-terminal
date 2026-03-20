export interface JWTPayload {
  userId: string;
  walletAddress: string;
  tokenVersion: number;
}

export interface Authn {
  extractToken(headers: Headers | Record<string, string | string[] | undefined>): string | null;
  verifyJwt(token: string, secret: string): Promise<JWTPayload>;
}

export interface TokenVersionStore {
  getTokenVersion(userId: string): Promise<number | null>;
}

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message?: string
  ) {
    super(message || code);
    this.name = "HttpError";
  }
}

export function extractBearerToken(
  headers: Headers | Record<string, string | string[] | undefined>
): string | null {
  let authHeader: string | undefined;

  if (typeof (headers as Headers).get === "function") {
    authHeader = (headers as Headers).get("authorization") ?? undefined;
  } else {
    const raw = (headers as Record<string, string | string[] | undefined>)["authorization"];
    authHeader = Array.isArray(raw) ? raw[0] : raw;
  }

  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  return null;
}

export async function requireUser(
  authn: Authn,
  headers: Headers | Record<string, string | string[] | undefined>,
  db: TokenVersionStore,
  jwtSecret: string
): Promise<JWTPayload> {
  const token = authn.extractToken(headers);
  if (!token) {
    throw new HttpError(401, "authentication_required", "Authentication required");
  }

  const payload = await authn.verifyJwt(token, jwtSecret);
  const version = await db.getTokenVersion(payload.userId);

  if (version === null || version !== payload.tokenVersion) {
    throw new HttpError(401, "session_revoked", "Session expired");
  }

  return payload;
}
