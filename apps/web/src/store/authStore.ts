import { create } from "zustand";

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
  login: (input: { user: AuthUser; token: string; wallet?: string | null }) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isAuthenticated: false,
  token: null,
  wallet: null,
  login: ({ user, token, wallet }) => {
    localStorage.setItem("token", token);
    set({
      user,
      token,
      wallet: wallet ?? user.walletAddress,
      isAuthenticated: true,
    });
  },
  logout: () => {
    localStorage.removeItem("token");
    set({
      user: null,
      token: null,
      wallet: null,
      isAuthenticated: false,
    });
  },
}));
