import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FundingMatrixModal } from "../FundingMatrixModal";
import { useMarketStore } from "@/store/marketStore";
import * as terminalActions from "@/lib/terminalActions";

describe("FundingMatrixModal", () => {
  beforeEach(() => {
    useMarketStore.setState({
      activeMarket: "BTC-USD",
      markets: [
        {
          symbol: "BTC-USD",
          name: "Bitcoin",
          lastPrice: 76400,
          markPrice: 76400,
          changePercent24h: 1.5,
          volume24h: 150000000,
          openInterest: 50,
          fundingRate: 0.000086, // positive: shorts earn
        },
        {
          symbol: "ETH-USD",
          name: "Ethereum",
          lastPrice: 2440,
          markPrice: 2440,
          changePercent24h: -0.8,
          volume24h: 80000000,
          openInterest: 200,
          fundingRate: -0.000045, // negative: longs earn
        },
        {
          symbol: "SOL-USD",
          name: "Solana",
          lastPrice: 185,
          markPrice: 185,
          changePercent24h: 4.2,
          volume24h: 95000000,
          openInterest: 300,
          fundingRate: 0.00025, // high yield: > 15% APR
        },
      ],
    });
  });

  it("renders modal header, summary metrics, and markets table", () => {
    render(<FundingMatrixModal open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByTestId("funding-matrix-modal")).toBeInTheDocument();
    expect(screen.getByText("Cross-Market Funding & APR Matrix")).toBeInTheDocument();
    expect(screen.getByText("CARRY YIELD")).toBeInTheDocument();
    expect(screen.getByText("Next Funding:")).toBeInTheDocument();

    // Table rows
    expect(screen.getByText("BTC-USD")).toBeInTheDocument();
    expect(screen.getByText("ETH-USD")).toBeInTheDocument();
    expect(screen.getAllByText("SOL-USD").length).toBeGreaterThanOrEqual(1);
  });

  it("filters markets based on filter chips", () => {
    render(<FundingMatrixModal open={true} onOpenChange={vi.fn()} />);

    // Click "Shorts Earn (+Rate)"
    const shortsEarnBtn = screen.getByRole("button", { name: "Shorts Earn (+Rate)" });
    fireEvent.click(shortsEarnBtn);

    expect(screen.getByText("BTC-USD")).toBeInTheDocument();
    expect(screen.getAllByText("SOL-USD").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("ETH-USD")).not.toBeInTheDocument();

    // Click "Longs Earn (-Rate)"
    const longsEarnBtn = screen.getByRole("button", { name: "Longs Earn (-Rate)" });
    fireEvent.click(longsEarnBtn);

    expect(screen.getByText("ETH-USD")).toBeInTheDocument();
    expect(screen.queryByText("BTC-USD")).not.toBeInTheDocument();
  });

  it("triggers yield capture order prefill when Capture button is clicked", () => {
    const dispatchSpy = vi.spyOn(terminalActions, "dispatchTerminalAction");
    const onOpenChange = vi.fn();

    render(<FundingMatrixModal open={true} onOpenChange={onOpenChange} />);

    const captureButtons = screen.getAllByRole("button", { name: /capture/i });
    expect(captureButtons.length).toBeGreaterThan(0);

    fireEvent.click(captureButtons[0]);

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "prefill-order",
      })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
