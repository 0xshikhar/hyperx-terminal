import axios from "axios";
import { useWallet } from "@/components/wallet/useWallet";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "content-type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const address = useWallet.getState().address;
  if (address) {
    config.headers = config.headers ?? {};
    config.headers["x-wallet-address"] = address;
  }
  return config;
});
