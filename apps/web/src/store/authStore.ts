import { create } from "zustand";
import { TOKEN_KEY } from "@/services/auth.constants";

export type AuthUser = {
  id: string;
  walletAddress: string;
  username?: string;
};

type AuthState = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  token: string | null;
  wallet: string | null;
  authReady: boolean;
  login: (input: { user: AuthUser; token: string; wallet?: string | null }) => void;
  logout: () => void;
  setAuthReady: (ready: boolean) => void;
  setSession: (input: { token: string; user?: AuthUser | null; wallet?: string | null }) => void;
};

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isAuthenticated: false,
  token: null,
  wallet: null,
  authReady: false,
  login: ({ user, token, wallet }) => {
    localStorage.setItem(TOKEN_KEY, token);
    set({
      user,
      token,
      wallet: wallet ?? user.walletAddress,
      isAuthenticated: true,
      authReady: true,
    });
  },
  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    set({
      user: null,
      token: null,
      wallet: null,
      isAuthenticated: false,
      authReady: true,
    });
  },
  setAuthReady: (authReady) => set({ authReady }),
  setSession: ({ token, user, wallet }) => {
    localStorage.setItem(TOKEN_KEY, token);
    set((state) => ({
      token,
      user: user ?? state.user,
      wallet: wallet ?? state.wallet ?? user?.walletAddress ?? null,
      isAuthenticated: true,
      authReady: true,
    }));
  },
}));
