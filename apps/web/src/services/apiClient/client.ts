import axios, { type InternalAxiosRequestConfig, type AxiosResponse, type AxiosError } from "axios";
import { useWallet } from "@/components/wallet/useWallet";
import { useLatencyStore } from "@/store/latencyStore";
import { getToken, removeToken } from "../auth.service";

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
  // Add JWT token if available
  const token = getToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  
  // Fallback to wallet address for backward compatibility
  const address = useWallet.getState().address;
  if (address && !token) {
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
    
    // Handle 401 errors - token expired or invalid
    if (error.response?.status === 401) {
      removeToken();
      const pathname = window.location.pathname;
      const url = error.config?.url ?? "";
      const isAuthRoute = pathname === "/login" || pathname === "/onboard";
      const isAuthRequest = url.includes("/auth/");
      const isMetricsRequest = url.includes("/metrics");

      if (!isAuthRoute && !isAuthRequest && !isMetricsRequest) {
        window.location.href = "/login";
      }
    }
    
    return Promise.reject(error);
  }
);
