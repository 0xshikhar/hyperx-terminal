import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TWAPOrderForm } from "@/components/trade-form/TWAPOrderForm";
import { usePaperTradingStore } from "@/store/paperTradingStore";

// Mock sound effects
vi.mock("@/lib/terminalAudio", () => ({
  terminalAudio: {
    playClick: vi.fn(),
    playOrderSubmit: vi.fn(),
    playOrderFill: vi.fn(),
  },
}));

describe("TWAPOrderForm", () => {
  beforeEach(() => {
    usePaperTradingStore.setState({
      balance: 10000,
      twapOrders: [],
    });
  });

  it("renders TWAP form with algorithmic order banner, inputs, and duration presets", () => {
    render(
      <TWAPOrderForm
        activeMarket="BTC-PERP"
        side="buy"
        leverage={10}
        markPrice={70000}
        isPaperTrading={true}
      />
    );

    expect(screen.getByText("TWAP Algorithmic Order")).toBeInTheDocument();
    expect(screen.getByText("Total Size")).toBeInTheDocument();
    expect(screen.getByTestId("twap-total-size-input")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "5m" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "15m" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1h" })).toBeInTheDocument();
  });

  it("calculates slice frequency and telemetry accurately", () => {
    render(
      <TWAPOrderForm
        activeMarket="BTC-PERP"
        side="buy"
        leverage={10}
        markPrice={60000}
        isPaperTrading={true}
      />
    );

    const input = screen.getByTestId("twap-total-size-input");
    fireEvent.change(input, { target: { value: "1.0" } });

    // With 15m (900s) and 5 slices => 1 order every 180s
    expect(screen.getByText(/1 order every 180s/i)).toBeInTheDocument();
    expect(screen.getByText(/~0.2000 BTC/i)).toBeInTheDocument();
    expect(screen.getByText("$60000.00")).toBeInTheDocument(); // 1.0 * 60000
    expect(screen.getByText("$6000.00")).toBeInTheDocument(); // 60000 / 10x
  });

  it("allows toggling anti-MEV size jitter", () => {
    render(
      <TWAPOrderForm
        activeMarket="BTC-PERP"
        side="buy"
        leverage={10}
        markPrice={70000}
        isPaperTrading={true}
      />
    );

    const jitterBtn = screen.getByText("ENABLED");
    expect(jitterBtn).toBeInTheDocument();

    fireEvent.click(jitterBtn);
    expect(screen.getByText("OFF")).toBeInTheDocument();
  });

  it("submits paper TWAP order and updates paperTradingStore", () => {
    const onPlaced = vi.fn();
    render(
      <TWAPOrderForm
        activeMarket="BTC-PERP"
        side="buy"
        leverage={10}
        markPrice={70000}
        isPaperTrading={true}
        onOrderPlaced={onPlaced}
      />
    );

    const submitBtn = screen.getByTestId("twap-submit-btn");
    expect(submitBtn).toBeEnabled();

    fireEvent.click(submitBtn);

    const twapOrders = usePaperTradingStore.getState().twapOrders;
    expect(twapOrders.length).toBe(1);
    expect(twapOrders[0].market).toBe("BTC-PERP");
    expect(twapOrders[0].side).toBe("buy");
    expect(twapOrders[0].totalSize).toBe(0.5);
    expect(twapOrders[0].status).toBe("running");
    expect(onPlaced).toHaveBeenCalledTimes(1);
  });
});
