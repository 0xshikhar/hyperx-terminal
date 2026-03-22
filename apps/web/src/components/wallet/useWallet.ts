import { create } from "zustand";
import { useNetworkStore } from "@/store/networkStore";

type WalletAccountType = import("starknet").WalletAccount;

export type WalletType = "starknet" | "paper";

export type WalletState = {
  isConnecting: boolean;
  isConnected: boolean;
  walletType: WalletType | null;
  isPaperWallet: boolean;
  address: string | null;
  walletName: string | null;
  chainId: string | null;
  account: WalletAccountType | null;
  isModalOpen: boolean;
  setModalOpen: (open: boolean) => void;
  connectWallet: () => Promise<void>;
  connectPaperWallet: () => void;
  disconnectWallet: () => Promise<void>;
};

const STARKNET_NETWORK = (import.meta.env.VITE_STARKNET_NETWORK ?? "sepolia").toLowerCase();
const RPC_URL = import.meta.env.VITE_STARKNET_RPC_URL?.trim() ?? "";
const DEFAULT_RPC_URL =
  STARKNET_NETWORK === "mainnet"
    ? "https://starknet-mainnet-rpc.publicnode.com"
    : "https://starknet-sepolia-rpc.publicnode.com";
const EFFECTIVE_RPC_URL = RPC_URL || DEFAULT_RPC_URL;

function getOrCreatePaperAddress(): string {
  if (typeof window === "undefined") return "0xpaper98a72b4c";
  const existing = window.localStorage.getItem("hyperx-paper-address");
  if (existing) return existing;
  const randomSuffix = Math.random().toString(16).substring(2, 10);
  const newAddress = `0xpaper${randomSuffix}`;
  window.localStorage.setItem("hyperx-paper-address", newAddress);
  return newAddress;
}

function getInitialWalletState() {
  if (typeof window === "undefined") {
    return {
      address: null,
      walletName: null,
      chainId: null,
      isConnected: false,
      walletType: null as WalletType | null,
      isPaperWallet: false,
    };
  }

  const walletType = window.localStorage.getItem("hyperx-wallet-type") as WalletType | null;

  if (walletType === "paper") {
    const address = getOrCreatePaperAddress();
    return {
      address,
      walletName: "Paper Wallet",
      chainId: "PAPER_SIMULATED",
      isConnected: true,
      walletType: "paper" as WalletType,
      isPaperWallet: true,
    };
  }

  const address = window.localStorage.getItem("starknet-address");
  const walletName = window.localStorage.getItem("starknet-wallet-name");
  const chainId = window.localStorage.getItem("starknet-chain-id");
  return {
    address,
    walletName,
    chainId,
    isConnected: Boolean(address),
    walletType: address ? ("starknet" as WalletType) : null,
    isPaperWallet: false,
  };
}

export const useWallet = create<WalletState>()((set, get) => {
  const initial = getInitialWalletState();

  return {
    isConnecting: false,
    isConnected: initial.isConnected,
    walletType: initial.walletType,
    isPaperWallet: initial.isPaperWallet,
    address: initial.address,
    walletName: initial.walletName,
    chainId: initial.chainId,
    account: null,
    isModalOpen: false,

    setModalOpen: (open: boolean) => set({ isModalOpen: open }),

    connectPaperWallet: () => {
      const address = getOrCreatePaperAddress();
      window.localStorage.setItem("hyperx-wallet-type", "paper");
      window.localStorage.removeItem("starknet-address");
      window.localStorage.removeItem("starknet-wallet-name");
      window.localStorage.removeItem("starknet-chain-id");

      useNetworkStore.getState().setTradingMode("paper");

      set({
        isConnected: true,
        walletType: "paper",
        isPaperWallet: true,
        address,
        walletName: "Paper Wallet",
        chainId: "PAPER_SIMULATED",
        account: null,
        isConnecting: false,
        isModalOpen: false,
      });
    },

    connectWallet: async () => {
      const state = get();
      if (state.isConnecting) return;

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
          throw new Error("No Starknet wallet selected");
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
        const walletName = swo.name ?? "Starknet Wallet";

        window.localStorage.setItem("hyperx-wallet-type", "starknet");
        window.localStorage.setItem("starknet-address", address);
        window.localStorage.setItem("starknet-wallet-name", walletName);
        if (chainId) {
          window.localStorage.setItem("starknet-chain-id", chainId);
        } else {
          window.localStorage.removeItem("starknet-chain-id");
        }

        // Set live network
        const net = chainId?.toLowerCase().includes("mainnet") ? "mainnet" : "testnet";
        useNetworkStore.getState().setNetwork(net);

        set({
          address,
          walletName,
          chainId,
          walletType: "starknet",
          isPaperWallet: false,
          isConnected: Boolean(address),
          isConnecting: false,
          account: walletAccount,
          isModalOpen: false,
        });
      } catch (err) {
        set({ isConnecting: false });
        throw err;
      }
    },

    disconnectWallet: async () => {
      try {
        const { disconnect } = await import("@starknet-io/get-starknet");
        await disconnect({ clearLastWallet: true });
      } catch {
        // Ignored if not connected to Starknet extension
      } finally {
        window.localStorage.removeItem("hyperx-wallet-type");
        window.localStorage.removeItem("starknet-address");
        window.localStorage.removeItem("starknet-wallet-name");
        window.localStorage.removeItem("starknet-chain-id");
        set({
          address: null,
          walletName: null,
          chainId: null,
          walletType: null,
          isPaperWallet: false,
          isConnected: false,
          isConnecting: false,
          account: null,
        });
      }
    },
  };
});
