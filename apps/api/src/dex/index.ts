/**
 * DEX Integration Index
 * 
 * Exports all DEX clients and the order routing service
 */

export { ExtendedClient, createExtendedClient } from "./ExtendedClient.js";
export { ParadexClient, createParadexClient } from "./ParadexClient.js";
export { OrderRouter, getOrderRouter, resetOrderRouter } from "./OrderRouter.js";
