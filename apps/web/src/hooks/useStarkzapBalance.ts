import { useEffect, useState } from "react";
import { getPresets } from "starkzap";
import { useInjectedStarkzapWallet } from "@/hooks/useInjectedStarkzapWallet";

export function useStarkzapBalance() {
  const getWallet = useInjectedStarkzapWallet();
  const [balance, setBalance] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const wallet = await getWallet();
        const presets = getPresets(wallet.getChainId());
        const strk = presets.STRK;
        if (!strk) {
          if (active) setBalance(null);
          return;
        }
        const balanceOf = (
          wallet as unknown as {
            balanceOf: (token: unknown) => Promise<{ toUnit: () => string }>;
          }
        ).balanceOf;
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
  }, [getWallet]);

  return balance;
}
