import * as path from "node:path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
import { createParadexClient } from "./src/dex/ParadexClient.js";

async function main() {
    const address = process.env.PARADEX_STARKNET_ADDRESS;
    const privateKey = process.env.PARADEX_STARKNET_PRIVATE_KEY;
    const jwtToken = process.env.PARADEX_JWT_TOKEN;
    const baseUrl =
        process.env.PARADEX_API_URL ||
        process.env.PARADEX_REST_URL ||
        "https://api.testnet.paradex.trade";
    const isTestnet = baseUrl.toLowerCase().includes("testnet");

    if (!jwtToken && (!address || !privateKey)) {
        console.error("Please provide PARADEX_STARKNET_ADDRESS and PARADEX_STARKNET_PRIVATE_KEY (or PARADEX_JWT_TOKEN) environment variables.");
        process.exit(1);
    }

    const client = createParadexClient({
        name: "paradex",
        baseUrl, // Use testnet for safe testing
        network: isTestnet ? "sepolia" : "mainnet",
        chainId: Number(process.env.PARADEX_CHAIN_ID ?? ""),
        credentials: {
            starknetAddress: address,
            starknetPrivateKey: privateKey,
            jwtToken,
        },
    });

    console.log("Authenticating and fetching account details...");
    try {
        const account = await client.getAccount();
        console.log("Account Details:", account);

        console.log("\nFetching open positions...");
        const positions = await client.getPositions();
        console.log("Positions:", positions);

        console.log("\nParadex Integration Success!");
    } catch (err) {
        console.error("Paradex API Error:", err);
    }
}

main();
