import type { AccountInterface } from "starknet";
import { useWallet } from "@/components/wallet/useWallet";
import { useNetworkStore } from "@/store/networkStore";
import { toParadexMarketSymbol } from "@hyperx/types/common";
import { placeOrder, type OrderInstruction, type PlaceOrderPayload, type PlaceOrderResponse } from "@/services/apiClient/orders.api";
import type { TradeOrder } from "@/components/trade-form/TradeForm";

// l2Signer pulls in starknet.js (~400 KB gzip) — keep it lazy so signing only
// costs when a live order is actually placed.
const loadParadexSigner = () => import("@/services/paradex/l2Signer");

/** Paradex execution instruction derived from our order flags. */
function resolveInstruction(order: TradeOrder): OrderInstruction {
  if (order.postOnly) return "POST_ONLY";
  if (order.tif === "IOC" || order.tif === "FOK") return order.tif;
  return "GTC";
}

function toVenueOrderType(type: TradeOrder["type"]): "MARKET" | "LIMIT" | "STOP_MARKET" {
  if (type === "limit") return "LIMIT";
  if (type === "stop") return "STOP_MARKET";
  return "MARKET";
}

/**
 * Sign + submit a live order to the venue-facing API.
 * Used by TradeForm and by position/order management actions (close, reverse).
 * Throws on API failure — callers handle UX.
 */
export async function submitSignedOrder(
  order: PlaceOrderPayload,
  walletAccount?: AccountInterface | null
): Promise<PlaceOrderResponse> {
  const account = walletAccount ?? useWallet.getState().account;
  const instruction = resolveInstruction(order);
  order.instruction = instruction;

  try {
    const { getParadexSigner } = await loadParadexSigner();
    const signer = getParadexSigner(account);
    if (signer) {
      const network = useNetworkStore.getState().network;
      const chainId =
        network === "mainnet"
          ? "PRIVATE_SN_PARADEX_MAINNET"
          : "PRIVATE_SN_PARADEX_SEPOLIA";
      const signed = await signer.signOrder({
        market: toParadexMarketSymbol(order.market),
        side: order.side === "buy" ? "BUY" : "SELL",
        orderType: toVenueOrderType(order.type),
        size: order.size,
        price: order.type === "limit" ? order.price : undefined,
        chainId,
      });
      order.signature = signed.signature;
      order.signatureTimestamp = signed.signatureTimestamp;
    }
  } catch (e) {
    // Signing is best-effort: the BFF may sign server-side for managed keys.
    // Surface in console; let the API decide whether the order is acceptable.
    console.warn("Client-side order signing skipped or failed:", e);
  }

  return placeOrder(order);
}

/** Normalize a place/cancel order failure into a user-facing message. */
export function orderErrorMessage(err: unknown): string {
  const axiosData = (err as { response?: { data?: { error?: string; message?: string } } })
    ?.response?.data;
  return (
    axiosData?.message ||
    axiosData?.error ||
    (err instanceof Error ? err.message : null) ||
    "Order request failed"
  );
}

/**
 * Close (or reduce) a live position with a reduce-only market order — the same
 * mechanism venues use; there is no separate "close" RPC.
 */
export async function closeLivePosition(params: {
  market: string;
  side: "long" | "short";
  size: number;
}): Promise<PlaceOrderResponse> {
  return submitSignedOrder({
    market: params.market,
    side: params.side === "long" ? "sell" : "buy",
    type: "market",
    size: String(params.size),
    reduceOnly: true,
    tif: "IOC",
  });
}
