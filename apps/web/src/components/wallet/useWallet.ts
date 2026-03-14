import { create } from "zustand";

type WalletAccountType = import("starknet").WalletAccount;

export type WalletState = {
  isConnecting: boolean;
  isConnected: boolean;
  address: string | null;
  walletName: string | null;
  chainId: string | null;
  account: WalletAccountType | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
};

const STARKNET_NETWORK = (import.meta.env.VITE_STARKNET_NETWORK ?? "sepolia").toLowerCase();
const RPC_URL = import.meta.env.VITE_STARKNET_RPC_URL?.trim() ?? "";
const DEFAULT_RPC_URL =
  STARKNET_NETWORK === "mainnet"
    ? "https://starknet-mainnet-rpc.publicnode.com"
    : "https://starknet-sepolia-rpc.publicnode.com";
const EFFECTIVE_RPC_URL = RPC_URL || DEFAULT_RPC_URL;

function getInitialWalletState() {
  if (typeof window === "undefined") {
    return { address: null, walletName: null, chainId: null, isConnected: false };
  }

  const address = window.localStorage.getItem("starknet-address");
  const walletName = window.localStorage.getItem("starknet-wallet-name");
  const chainId = window.localStorage.getItem("starknet-chain-id");
  return {
    address,
    walletName,
    chainId,
    isConnected: Boolean(address),
  };
}

export const useWallet = create<WalletState>()((set, get) => {
  const initial = getInitialWalletState();

  return {
    isConnecting: false,
    isConnected: initial.isConnected,
    address: initial.address,
    walletName: initial.walletName,
    chainId: initial.chainId,
    account: null,

    connectWallet: async () => {
      const state = get();
      if (state.isConnecting || state.isConnected) return;

      set({ isConnecting: true });
      try {
        const [{ connect }, { RpcProvider, WalletAccount }] = await Promise.all([
          import("@starknet-io/get-starknet"),
          import("starknet"),
        ]);
        const swo = await connect({
          modalMode: "alwaysAsk",
          modalTheme: "dark",
        });
        if (!swo) {
          throw new Error("Failed to connect Starknet wallet");
        }

        let chainId: string | null = null;
        try {
          chainId = await swo.request({ type: "wallet_requestChainId" });
        } catch {
          // Some wallets/versions may not implement this yet.
        }

        const provider = new RpcProvider({ nodeUrl: EFFECTIVE_RPC_URL });
        const walletAccount = await WalletAccount.connect(provider, swo);
        const address = walletAccount.address;
        const walletName = swo.name ?? null;

        window.localStorage.setItem("starknet-address", address);
        window.localStorage.setItem("starknet-wallet-name", walletName ?? "");
        if (chainId) {
          window.localStorage.setItem("starknet-chain-id", chainId);
        } else {
          window.localStorage.removeItem("starknet-chain-id");
        }

        set({
          address,
          walletName,
          chainId,
          isConnected: Boolean(address),
          isConnecting: false,
          account: walletAccount,
        });
      } finally {
        set({ isConnecting: false });
      }
    },

    disconnectWallet: async () => {
      try {
        const { disconnect } = await import("@starknet-io/get-starknet");
        await disconnect({ clearLastWallet: true });
      } catch {
        return;
      } finally {
        window.localStorage.removeItem("starknet-address");
        window.localStorage.removeItem("starknet-wallet-name");
        window.localStorage.removeItem("starknet-chain-id");
        set({
          address: null,
          walletName: null,
          chainId: null,
          isConnected: false,
          isConnecting: false,
          account: null,
        });
      }
    },
  };
});
