import "dotenv/config";
import { TickBatcher } from "./batcher.js";
import { ParadexIngestBridge } from "./paradexBridge.js";

const TARGET_API_URL = process.env.TARGET_API_URL || "http://localhost:3001";
const INGEST_HMAC_SECRET = process.env.INGEST_HMAC_SECRET || process.env.JWT_SECRET || "dev-jwt-secret-change-in-production";
const FLUSH_INTERVAL_MS = Number(process.env.FLUSH_INTERVAL_MS ?? 1000);

console.log(`[IngestDaemon] Booting with Target: ${TARGET_API_URL}, Flush: ${FLUSH_INTERVAL_MS}ms`);

const batcher = new TickBatcher({
  targetUrl: TARGET_API_URL,
  hmacSecret: INGEST_HMAC_SECRET,
  flushIntervalMs: FLUSH_INTERVAL_MS,
});

const bridges: ParadexIngestBridge[] = [];

const testnetBridge = new ParadexIngestBridge({
  network: "testnet",
  wsUrl: process.env.PARADEX_WS_URL || "wss://ws.api.testnet.paradex.trade/v1",
  batcher,
});
testnetBridge.start();
bridges.push(testnetBridge);

const mainnetEnabled = process.env.ENABLE_MAINNET_INGEST?.toLowerCase() === "true";
if (mainnetEnabled) {
  const mainnetBridge = new ParadexIngestBridge({
    network: "mainnet",
    wsUrl: process.env.PARADEX_MAINNET_WS_URL || "wss://ws.api.prod.paradex.trade/v1",
    batcher,
  });
  mainnetBridge.start();
  bridges.push(mainnetBridge);
}

function shutdown() {
  console.log("[IngestDaemon] Shutting down gracefully...");
  for (const bridge of bridges) {
    bridge.stop();
  }
  batcher.stop();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
