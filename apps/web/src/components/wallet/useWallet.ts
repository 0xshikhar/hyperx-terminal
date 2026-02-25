import { useCallback, useEffect, useState } from "react";
import { connect, disconnect } from "@starknet-io/get-starknet";
import { RpcProvider, WalletAccount } from "starknet";

export type WalletState = {
  address?: string;
  walletName?: string;
  isConnected: boolean;
  isConnecting: boolean;
};

const RPC_URL = import.meta.env.VITE_STARKNET_RPC_URL ?? "";

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    isConnected: false,
    isConnecting: false,
  });

  useEffect(() => {
    const storedAddress = localStorage.getItem("starknet-address");
    const storedName = localStorage.getItem("starknet-wallet-name");
    if (storedAddress) {
      setState({
        address: storedAddress,
        walletName: storedName || undefined,
        isConnected: true,
        isConnecting: false,
      });
    }
  }, []);

  const connectWallet = useCallback(async () => {
    if (state.isConnecting) return;
    setState((prev) => ({ ...prev, isConnecting: true }));

    try {
      const swo = await connect({ modalMode: "alwaysAsk", modalTheme: "dark" });
      if (!swo) {
        throw new Error("No Starknet wallet found");
      }

      const provider = new RpcProvider({ nodeUrl: RPC_URL });
      const account = await WalletAccount.connect(provider, swo);
      const address = account.address;

      setState({
        address,
        walletName: swo.name,
        isConnected: true,
        isConnecting: false,
      });

      localStorage.setItem("starknet-address", address);
      localStorage.setItem("starknet-wallet-name", swo.name ?? "");
    } catch (error) {
      setState((prev) => ({ ...prev, isConnecting: false }));
      throw error;
    }
  }, [state.isConnecting]);

  const disconnectWallet = useCallback(async () => {
    await disconnect({ clearLastWallet: true });
    setState({
      address: undefined,
      walletName: undefined,
      isConnected: false,
      isConnecting: false,
    });
    localStorage.removeItem("starknet-address");
    localStorage.removeItem("starknet-wallet-name");
  }, []);

  return {
    ...state,
    connectWallet,
    disconnectWallet,
  };
}
