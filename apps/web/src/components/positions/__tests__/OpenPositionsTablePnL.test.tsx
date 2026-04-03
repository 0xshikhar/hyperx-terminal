import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OpenPositionsTable } from "@/components/positions/OpenPositionsTable";
import { usePaperTradingStore } from "@/store/paperTradingStore";
import { usePnlSettingsStore } from "@/store/pnlSettingsStore";
import { useNetworkStore } from "@/store/networkStore";

// Mock sounds
vi.mock("@/lib/terminalAudio", () => ({
  terminalAudio: {
    playClick: vi.fn(),
    playOrderSubmit: vi.fn(),
    playOrderFill: vi.fn(),
    playOrderCancel: vi.fn(),
  },
}));

describe("OpenPositionsTable - PnL Modes & Breakeven Engine", () => {
  beforeEach(() => {
    useNetworkStore.setState({ isPaperTrading: true });
    usePnlSettingsStore.setState({ pnlMode: "both", feeRate: 0.0005 });
    usePaperTradingStore.setState({
      balance: 10000,
      positions: [
        {
          id: "pos-btc-1",
          market: "BTC-PERP",
          side: "long",
          size: 0.5,
          entryPrice: 60000,
          markPrice: 63000,
          pnl: 1500,
          pnlPercent: 25.0,
          margin: 3000,
          leverage: 10,
          openedAt: "2026-09-19T00:00:00Z",
        },
      ],
      openOrders: [],
    });
  });

  it("renders PnL mode switcher with Both, $ USD, and % ROE options", () => {
    render(<OpenPositionsTable />);

    expect(screen.getByText("PnL Mode:")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Both" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "$ USD" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "% ROE" })).toBeInTheDocument();
  });

  it("switches PnL presentation mode when toggled", () => {
    render(<OpenPositionsTable />);

    // Default "both" mode should show: +$1,500 (+25%)
    expect(screen.getByText(/\+\$1,500.*25%/i)).toBeInTheDocument();

    // Switch to USD only
    fireEvent.click(screen.getByRole("button", { name: "$ USD" }));
    expect(usePnlSettingsStore.getState().pnlMode).toBe("usd");
    expect(screen.getByText(/\+\$1,500/i)).toBeInTheDocument();

    // Switch to % ROE only
    fireEvent.click(screen.getByRole("button", { name: "% ROE" }));
    expect(usePnlSettingsStore.getState().pnlMode).toBe("percent");
    expect(screen.getByText(/\+25%/i)).toBeInTheDocument();
  });

  it("renders fee-adjusted Breakeven price indicator", () => {
    render(<OpenPositionsTable />);

    // For 60000 long, BE ≈ 60000 * 1.0010005 ≈ 60060.03
    expect(screen.getByText(/BE: \$60,060\.03/i)).toBeInTheDocument();
  });

  it("places a reduce-only limit close order at Breakeven when BE button is clicked", () => {
    render(<OpenPositionsTable />);

    const beButton = screen.getByTitle(/Place reduce-only limit exit order at exact breakeven price/i);
    expect(beButton).toBeInTheDocument();

    fireEvent.click(beButton);

    const openOrders = usePaperTradingStore.getState().openOrders;
    expect(openOrders.length).toBe(1);
    expect(openOrders[0].market).toBe("BTC-PERP");
    expect(openOrders[0].side).toBe("sell"); // Opposite of long
    expect(openOrders[0].price).toBeCloseTo(60060.03, 1);
  });
});
