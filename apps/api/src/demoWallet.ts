/**
 * Local-only demo fixtures. Imported by API routes that are gated on DEMO_MODE === "true".
 * Production boots refuse DEMO_MODE (see productionGuards.ts). CI greps fail if these
 * strings leak into apps/web/src or other apps/api/src files.
 */
export const DEMO_WALLET = "0x59045071c2216c948340eedfd23193f21d1c64fdbe6f51983fae9c34e12152";

export const DEMO_ACCOUNT = {
  balance: 242108.5,
  available: 192108.5,
  marginUsed: 50000.0,
  unrealizedPnl: 6007.85,
};

export function isDemoWallet(address: string | undefined): boolean {
  return Boolean(address && address.toLowerCase() === DEMO_WALLET.toLowerCase());
}
