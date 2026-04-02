import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { TradeForm } from "../TradeForm";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { KeyboardShortcutsProvider } from "@/hooks/useKeyboardShortcuts";
import { useMarketStore } from "@/store/marketStore";
import { usePaperTradingStore } from "@/store/paperTradingStore";
import { useWallet } from "@/components/wallet/useWallet";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

function renderTradeForm() {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <KeyboardShortcutsProvider>
        <TradeForm />
      </KeyboardShortcutsProvider>
    </QueryClientProvider>
  );
}

describe("1-Click Trading (1CT Mode)", () => {
  beforeEach(() => {
    cleanup();
    document.body.innerHTML = "";
    localStorage.clear();
    useMarketStore.setState({
      activeMarket: "BTC-USD",
      markets: [
        {
          symbol: "BTC-USD",
          name: "Bitcoin",
          lastPrice: 70000.0,
          changePercent24h: 2.0,
          volume24h: 1000000,
          openInterest: 100,
          fundingRate: 0.0001,
        },
      ],
    });
    useWallet.setState({
      isConnected: true,
      isPaperWallet: true,
      address: "0x1234",
    });
    usePaperTradingStore.setState({
      balance: 10000,
      positions: [],
      openOrders: [],
    });
  });

  it("renders 1CT toggle button in header", () => {
    renderTradeForm();
    const btn1CT = screen.getByRole("button", { name: /1CT/i });
    expect(btn1CT).toBeInTheDocument();
  });

  it("toggles 1CT state between ON and OFF and persists to localStorage", () => {
    renderTradeForm();
    const btn1CT = screen.getByRole("button", { name: /1CT/i });

    // Initially OFF
    expect(btn1CT).toHaveTextContent("OFF");

    // Click to turn ON
    fireEvent.click(btn1CT);
    expect(btn1CT).toHaveTextContent("ON");
    expect(localStorage.getItem("hyperx-one-click-trading")).toBe("true");

    // Click again to turn OFF
    fireEvent.click(btn1CT);
    expect(btn1CT).toHaveTextContent("OFF");
    expect(localStorage.getItem("hyperx-one-click-trading")).toBe("false");
  });

  it("opens confirmation dialog when 1CT is OFF and Buy is clicked", async () => {
    renderTradeForm();

    // Fill size
    const sizeInput = screen.getByPlaceholderText("0.00");
    fireEvent.change(sizeInput, { target: { value: "0.1" } });

    // Click Buy / Long submit CTA
    const buyButton = screen.getByTestId("buy-submit-btn");
    fireEvent.click(buyButton);

    // Confirmation dialog should appear
    expect(await screen.findByText(/Confirm Paper Order/i)).toBeInTheDocument();
  });

  it("executes order immediately without dialog when 1CT is ON", async () => {
    localStorage.setItem("hyperx-one-click-trading", "true");
    renderTradeForm();

    // Fill size
    const sizeInput = screen.getByPlaceholderText("0.00");
    fireEvent.change(sizeInput, { target: { value: "0.1" } });

    // Click Buy / Long submit CTA
    const buyButton = screen.getByTestId("buy-submit-btn");
    fireEvent.click(buyButton);

    // Dialog should NOT be open
    expect(screen.queryByText(/Confirm Paper Order/i)).not.toBeInTheDocument();

    // Position should be filled directly in paperTradingStore
    const positions = usePaperTradingStore.getState().positions;
    expect(positions.length).toBe(1);
    expect(positions[0].market).toBe("BTC-USD");
    expect(positions[0].side).toBe("long");
    expect(positions[0].size).toBe(0.1);
  });
});
