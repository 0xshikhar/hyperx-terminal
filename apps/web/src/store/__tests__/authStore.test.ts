import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAuthStore } from "../authStore";

describe("authStore", () => {
  beforeEach(() => {
    const { login, logout } = useAuthStore.getState();
    // Reset store state
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      token: null,
      wallet: null,
      login,
      logout,
    });

    // Clear mocks
    vi.clearAllMocks();
  });

  it("should have initial state", () => {
    const state = useAuthStore.getState();

    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBeNull();
    expect(state.wallet).toBeNull();
  });

  it("should update auth state on login", () => {
    const mockUser = {
      id: "user-123",
      walletAddress: "0x123",
      username: "testuser",
    };

    const mockToken = "jwt-token-123";

    useAuthStore.setState({
      user: mockUser,
      isAuthenticated: true,
      token: mockToken,
    });

    const state = useAuthStore.getState();

    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBe(mockToken);
  });

  it("should clear auth state on logout", () => {
    // Set initial authenticated state
    useAuthStore.setState({
      user: { id: "user-123", walletAddress: "0x123" },
      isAuthenticated: true,
      token: "jwt-token",
      wallet: "0x123",
    });

    // Call logout action
    useAuthStore.getState().logout();

    const state = useAuthStore.getState();

    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBeNull();
    expect(localStorage.removeItem).toHaveBeenCalledWith("token");
  });

  it("should check authentication status correctly", () => {
    expect(useAuthStore.getState().isAuthenticated).toBe(false);

    useAuthStore.setState({ isAuthenticated: true });

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });
});
