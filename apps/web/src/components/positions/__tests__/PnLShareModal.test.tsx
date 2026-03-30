import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PnLShareModal } from "@/components/positions/PnLShareModal";
import type { Position } from "@/store/positionsStore";

describe("PnLShareModal", () => {
  const mockPosition: Position = {
    id: "pos-1",
    market: "BTC-USD",
    side: "long",
    size: 0.5,
    entryPrice: 76000,
    markPrice: 78000,
    pnl: 1000,
    pnlPercent: 26.32,
    margin: 3800,
    leverage: 10,
    openedAt: "2026-09-19T00:00:00Z",
  };

  it("renders PnL share card with position details when open", () => {
    render(<PnLShareModal position={mockPosition} open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("SHARE P&L CARD")).toBeInTheDocument();
    expect(screen.getByText("HYPERX")).toBeInTheDocument();
    expect(screen.getByText("BTC-USD")).toBeInTheDocument();
    expect(screen.getByText("+26.32%")).toBeInTheDocument();
    expect(screen.getByText("+$1,000.00 USD")).toBeInTheDocument();
  });

  it("does not render when position is null", () => {
    const { container } = render(<PnLShareModal position={null} open={true} onOpenChange={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});
