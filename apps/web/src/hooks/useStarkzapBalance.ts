import { useEffect, useState } from "react";
import { useWallet } from "@/components/wallet/useWallet";

type BalanceWallet = {
  balanceOf: (token: unknown) => Promise<{ toUnit: () => string }>;
};

export function useStarkzapBalance() {
  const account = useWallet((state) => state.account);
  const chainId = useWallet((state) => state.chainId);
  const [balance, setBalance] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        if (!account || !chainId) {
          if (active) setBalance(null);
          return;
        }

        const [{ getPresets }, { InjectedStarkzapWallet }] = await Promise.all([
          import("starkzap"),
          import("@/lib/starkzap/InjectedStarkzapWallet"),
        ]);

        const wallet = await InjectedStarkzapWallet.fromAccount(account as never);
        const presets = getPresets(wallet.getChainId());
        const strk = presets.STRK;
        if (!strk) {
          if (active) setBalance(null);
          return;
        }
        const balanceOf = (wallet as BalanceWallet).balanceOf.bind(wallet);
        const amount = await balanceOf(strk);
        if (active) setBalance(amount.toUnit());
      } catch {
        if (active) setBalance(null);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [account, chainId]);

  return balance;
}
