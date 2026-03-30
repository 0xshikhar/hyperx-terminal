import { useNetworkStore } from "@/store/networkStore";
import { useWallet } from "@/components/wallet/useWallet";

/**
 * Returns true if the active trading context is Paper Trading (either because
 * the network tradingMode is 'paper' or the connected wallet is a Paper Wallet).
 */
export function useIsPaperTrading(): boolean {
  const isNetworkPaper = useNetworkStore((s) => s.isPaperTrading);
  const isPaperWallet = useWallet((s) => s.isPaperWallet);
  return isNetworkPaper || isPaperWallet;
}
