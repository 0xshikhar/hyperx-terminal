import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PositionTPSLModal } from "../PositionTPSLModal";
import type { Position } from "@/store/positionsStore";
import { usePaperTradingStore } from "@/store/paperTradingStore";

describe("PositionTPSLModal", () => {
  const mockPosition: Position = {
    id: "pos-tpsl-1",
    market: "BTC-USD-PERP",
    side: "long",
    size: 1.0,
    entryPrice: 70000,
    markPrice: 70000,
    pnl: 0,
    pnlPercent: 0,
    margin: 7000,
    leverage: 10,
    openedAt: "2026-09-19T00:00:00Z",
  };

  beforeEach(() => {
    usePaperTradingStore.getState().resetAccount();
  });

  it("renders TP/SL modal with position details and ROI buttons", () => {
    render(
      <PositionTPSLModal
        position={mockPosition}
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    expect(screen.getByText("POSITION TP/SL BRACKET")).toBeInTheDocument();
    expect(screen.getByText("BTC-USD-PERP")).toBeInTheDocument();
    expect(screen.getByText("+10% ROI")).toBeInTheDocument();
    expect(screen.getByText("+25% ROI")).toBeInTheDocument();
    expect(screen.getByText("+50% ROI")).toBeInTheDocument();
    expect(screen.getByText("+100% ROI")).toBeInTheDocument();
    expect(screen.getByText("-5% ROI")).toBeInTheDocument();
    expect(screen.getByText("-10% ROI")).toBeInTheDocument();
    expect(screen.getByText("-25% ROI")).toBeInTheDocument();
    expect(screen.getByText("-50% ROI")).toBeInTheDocument();
  });

  it("calculates target price when quick ROI button is clicked", () => {
    render(
      <PositionTPSLModal
        position={mockPosition}
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    // Click +25% ROI button for Long @ 10x leverage
    // price = 70,000 * (1 + 0.25 / 10) = 70,000 * 1.025 = 71750
    fireEvent.click(screen.getByText("+25% ROI"));

    const tpInput = screen.getByLabelText("Take-Profit (TP)") as HTMLInputElement;
    expect(Number(tpInput.value)).toBe(71750);
  });

  it("calculates stop price when quick SL ROI button is clicked", () => {
    render(
      <PositionTPSLModal
        position={mockPosition}
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    // Click -10% ROI button for Long @ 10x leverage
    // price = 70,000 * (1 - 0.10 / 10) = 70,000 * 0.99 = 69300
    fireEvent.click(screen.getByText("-10% ROI"));

    const slInput = screen.getByLabelText("Stop-Loss (SL)") as HTMLInputElement;
    expect(Number(slInput.value)).toBe(69300);
  });

  it("submits TP/SL bracket and calls updatePositionTPSL on paperTradingStore", () => {
    // Add position to paperTradingStore
    usePaperTradingStore.setState({
      positions: [mockPosition],
    });

    const onOpenChange = vi.fn();
    render(
      <PositionTPSLModal
        position={mockPosition}
        open={true}
        onOpenChange={onOpenChange}
      />
    );

    // Set TP to 75000 and SL to 68000
    const tpInput = screen.getByLabelText("Take-Profit (TP)");
    const slInput = screen.getByLabelText("Stop-Loss (SL)");
    fireEvent.change(tpInput, { target: { value: "75000" } });
    fireEvent.change(slInput, { target: { value: "68000" } });

    // Submit form
    const submitBtn = screen.getByText("CONFIRM TP/SL BRACKET");
    fireEvent.click(submitBtn);

    const updated = usePaperTradingStore.getState().positions.find((p) => p.id === mockPosition.id);
    expect(updated?.takeProfit).toBe(75000);
    expect(updated?.stopLoss).toBe(68000);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
