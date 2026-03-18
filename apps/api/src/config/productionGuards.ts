export type ProductionGuardEnv = {
  NODE_ENV?: string;
  DEMO_MODE?: string;
  DEMO_ALLOW_TRADES?: string;
  FF_ALLOW_MASTER_KEY?: string;
  PARADEX_STARKNET_PRIVATE_KEY?: string;
  JWT_SECRET?: string;
};

const DEFAULT_JWT_SECRET = "dev-jwt-secret-change-in-production";

export function isTruthyFlag(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

export function isSetSecret(value: string | undefined): boolean {
  return Boolean(value && value.trim() !== "");
}

/**
 * Production must not boot with demo theater, operator-key trading, or the default JWT secret.
 * Returns the names of violating flags (empty = safe).
 */
export function collectProductionGuardErrors(env: ProductionGuardEnv): string[] {
  if (env.NODE_ENV !== "production") return [];

  const errors: string[] = [];
  if (isTruthyFlag(env.DEMO_MODE)) errors.push("DEMO_MODE");
  if (isTruthyFlag(env.DEMO_ALLOW_TRADES)) errors.push("DEMO_ALLOW_TRADES");
  if (isTruthyFlag(env.FF_ALLOW_MASTER_KEY)) errors.push("FF_ALLOW_MASTER_KEY");
  if (isSetSecret(env.PARADEX_STARKNET_PRIVATE_KEY)) errors.push("PARADEX_STARKNET_PRIVATE_KEY");
  if (!env.JWT_SECRET || env.JWT_SECRET === DEFAULT_JWT_SECRET) errors.push("JWT_SECRET");
  return errors;
}

export function enforceProductionGuards(env: ProductionGuardEnv): void {
  const errors = collectProductionGuardErrors(env);
  if (errors.length === 0) return;

  console.error(
    `Refusing to boot: production cannot set ${errors.join(", ")}. ` +
      "Demo mode and the Paradex master key are local-only."
  );
  process.exit(1);
}
