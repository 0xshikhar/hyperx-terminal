import { useCallback } from "react";
import { useWallet } from "@/components/wallet/useWallet";
import { InjectedStarkzapWallet } from "@/lib/starkzap/InjectedStarkzapWallet";

export function useInjectedStarkzapWallet() {
  const account = useWallet((state) => state.account);

  return useCallback(async () => {
    if (!account) {
      throw new Error("Connect your Starknet wallet to continue");
    }
    return InjectedStarkzapWallet.fromAccount(account as never);
  }, [account]);
}
