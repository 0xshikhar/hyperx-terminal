import axios, { type InternalAxiosRequestConfig, type AxiosResponse, type AxiosError } from "axios";
import { useWallet } from "@/components/wallet/useWallet";
import { useLatencyStore } from "@/store/latencyStore";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "content-type": "application/json",
  },
});

interface CustomConfig extends InternalAxiosRequestConfig {
  metadata?: {
    startTime?: number;
  };
}

apiClient.interceptors.request.use((config: CustomConfig) => {
  const address = useWallet.getState().address;
  if (address) {
    config.headers = config.headers ?? {};
    config.headers["x-wallet-address"] = address;
  }
  config.metadata = { startTime: Date.now() };
  return config;
});

apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    const startTime = (response.config as CustomConfig).metadata?.startTime;
    if (startTime) {
      const latency = Date.now() - startTime;
      useLatencyStore.getState().setApiLatency(latency);
    }
    return response;
  },
  (error: AxiosError) => {
    const startTime = (error.config as CustomConfig)?.metadata?.startTime;
    if (startTime) {
      const latency = Date.now() - startTime;
      useLatencyStore.getState().setApiLatency(latency);
    }
    return Promise.reject(error);
  }
);
