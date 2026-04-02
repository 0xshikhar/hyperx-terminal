import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PartialCloseModal } from "../PartialCloseModal";
import type { Position } from "@/store/positionsStore";

describe("PartialCloseModal", () => {
  const mockPosition: Position = {
    id: "pos-1",
    market: "BTC-USD-PERP",
    side: "long",
    size: 1.0,
    entryPrice: 70000,
    markPrice: 74000,
    pnl: 4000,
    pnlPercent: 57.14,
    margin: 7000,
    leverage: 10,
    openedAt: "2026-09-19T00:00:00Z",
  };

  it("renders partial close modal with position data and percentage pills", () => {
    render(<PartialCloseModal position={mockPosition} open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("PARTIAL POSITION CLOSE")).toBeInTheDocument();
    expect(screen.getByText("BTC-USD-PERP")).toBeInTheDocument();
    expect(screen.getByText("Total: 1.0000")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "25%" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "50%" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "75%" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "100%" })).toBeInTheDocument();
  });

  it("updates close quantity when percentage button is clicked", () => {
    render(<PartialCloseModal position={mockPosition} open={true} onOpenChange={vi.fn()} />);

    // Click 25% button
    const btn25 = screen.getByText("25%");
    fireEvent.click(btn25);

    // Size input should update to 0.2500
    const sizeInput = screen.getByPlaceholderText("0.00") as HTMLInputElement;
    expect(sizeInput.value).toBe("0.2500");
  });

  it("switches to limit close mode and shows limit price input", () => {
    render(<PartialCloseModal position={mockPosition} open={true} onOpenChange={vi.fn()} />);

    const limitBtn = screen.getByText("Limit Close (Reduce-Only)");
    fireEvent.click(limitBtn);

    expect(screen.getByPlaceholderText("Enter limit exit price")).toBeInTheDocument();
  });
});
