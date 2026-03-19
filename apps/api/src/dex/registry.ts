import { env } from "../config/env.js";
import { demoTradesAllowed } from "../authz/paradexAccess.js";
import {
  getOrderRouter,
  createExtendedClient,
  createParadexClient,
  ExtendedClient,
  ParadexClient,
} from "./index.js";
import type { ParadexNetwork } from "@hyperx/types/common";
import { fromParadexMarketSymbol } from "@hyperx/types/common";

export const orderRouter = getOrderRouter();
export const dexClients = new Map<string, ExtendedClient | ParadexClient>();
export let extendedClient: ExtendedClient | null = null;
export const paradexClients = new Map<ParadexNetwork, ParadexClient | null>();
export const paradexMarketClients = new Map<ParadexNetwork, ParadexClient | null>();
export const paradexOnboardingStatus = new Map<
  ParadexNetwork,
  { checked: boolean; onboarded: boolean; error?: string }
>();

export function resolveParadexUrl(network: ParadexNetwork): string {
  if (network === "mainnet") {
    return (
      env.PARADEX_MAINNET_API_URL ||
      env.PARADEX_REST_URL ||
      "https://api.prod.paradex.trade"
    );
  }
  return (
    env.PARADEX_API_URL ||
    env.PARADEX_REST_URL ||
    "https://api.testnet.paradex.trade"
  );
}

export const hasParadexAuth = Boolean(
  env.PARADEX_JWT_TOKEN ||
    (env.PARADEX_STARKNET_ADDRESS && env.PARADEX_STARKNET_PRIVATE_KEY)
);
export const allowMasterParadexClients = demoTradesAllowed(env);

export const paradexNetworks: ParadexNetwork[] = ["testnet", "mainnet"];

for (const network of paradexNetworks) {
  const baseUrl = resolveParadexUrl(network);
  const isTestnet = network === "testnet";

  // Unauthenticated market client (always created)
  const marketClient = createParadexClient({
    name: `paradex-market-${network}`,
    baseUrl,
    chainId: Number(env.PARADEX_CHAIN_ID ?? ""),
    network: isTestnet ? "sepolia" : "mainnet",
  });
  paradexMarketClients.set(network, marketClient);

  // Authenticated master client is local-demo only. Money paths never call it
  // unless canUseMasterParadexClient() is true (no ParadexSession table yet).
  if (allowMasterParadexClients && hasParadexAuth) {
    const client = createParadexClient({
      name: `paradex-${network}`,
      baseUrl,
      chainId: Number(env.PARADEX_CHAIN_ID ?? ""),
      network: isTestnet ? "sepolia" : "mainnet",
      credentials: {
        starknetAddress: env.PARADEX_STARKNET_ADDRESS,
        starknetPrivateKey: env.PARADEX_STARKNET_PRIVATE_KEY,
        jwtToken: env.PARADEX_JWT_TOKEN,
      },
    });
    paradexClients.set(network, client);
    orderRouter.registerExchange(`paradex-${network}`, client);
    dexClients.set(`paradex-${network}`, client);
  } else {
    paradexClients.set(network, null);
  }
}

if (env.EXTENDED_API_KEY && env.EXTENDED_API_SECRET) {
  extendedClient = createExtendedClient({
    name: "extended",
    baseUrl: env.EXTENDED_API_URL || "https://api.extended.exchange",
    chainId: Number(env.EXTENDED_CHAIN_ID) || 1,
    network: "mainnet",
    credentials: {
      apiKey: env.EXTENDED_API_KEY,
      apiSecret: env.EXTENDED_API_SECRET,
    },
  });
  orderRouter.registerExchange("extended", extendedClient);
  dexClients.set("extended", extendedClient);
}

export async function checkParadexOnboarding(network: ParadexNetwork) {
  const client = paradexClients.get(network);
  if (!client) {
    paradexOnboardingStatus.set(network, {
      checked: true,
      onboarded: false,
      error: "no_client",
    });
    return;
  }
  try {
    const account = await client.getAccount();
    const status = account.status?.toUpperCase();
    if (status === "NOT_ONBOARDED") {
      paradexOnboardingStatus.set(network, { checked: true, onboarded: false });
      console.warn(`Paradex ${network} account is NOT_ONBOARDED — call /onboarding first`);
    } else {
      paradexOnboardingStatus.set(network, { checked: true, onboarded: true });
    }
  } catch (error) {
    paradexOnboardingStatus.set(network, {
      checked: true,
      onboarded: false,
      error: (error as Error).message,
    });
    console.error(`Failed to check Paradex ${network} onboarding:`, (error as Error).message);
  }
}

void checkParadexOnboarding("testnet");
void checkParadexOnboarding("mainnet");

export function getParadexClient(network: ParadexNetwork): ParadexClient | null {
  return paradexClients.get(network) ?? null;
}

export function getParadexMarketClient(network: ParadexNetwork): ParadexClient | null {
  return paradexMarketClients.get(network) ?? null;
}

export const CORE_PERP_BASES = new Set(["BTC", "ETH", "SOL", "STRK", "HYPE"]);

export function isCorePerpMarket(m: Record<string, unknown>): boolean {
  const rawMarket = (m.market ?? m.symbol ?? "") as string;
  if (!rawMarket.endsWith("-PERP")) return false;
  const base = (m.base_currency ?? m.baseCurrency ?? "") as string;
  if (!base) {
    const symbol = fromParadexMarketSymbol(rawMarket);
    return symbol ? CORE_PERP_BASES.has(symbol.split("-")[0] ?? "") : false;
  }
  return CORE_PERP_BASES.has(base);
}
