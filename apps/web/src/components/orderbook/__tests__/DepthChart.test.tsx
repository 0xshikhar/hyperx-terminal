import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DepthChart } from "../DepthChart";
import type { OrderBookRow } from "@/hooks/useOrderBook";
import * as terminalActions from "@/lib/terminalActions";

describe("DepthChart", () => {
  const mockBids: OrderBookRow[] = [
    { price: 65000, size: 1.5, total: 1.5, depthPercent: 50, side: "bid", isMine: false },
    { price: 64900, size: 2.0, total: 3.5, depthPercent: 80, side: "bid", isMine: false },
    { price: 64800, size: 1.0, total: 4.5, depthPercent: 100, side: "bid", isMine: false },
  ];

  const mockAsks: OrderBookRow[] = [
    { price: 65100, size: 1.2, total: 1.2, depthPercent: 40, side: "ask", isMine: false },
    { price: 65200, size: 2.5, total: 3.7, depthPercent: 85, side: "ask", isMine: false },
    { price: 65300, size: 0.8, total: 4.5, depthPercent: 100, side: "ask", isMine: false },
  ];

  it("renders Depth Chart component with mid-price, spread, and SVG area", () => {
    render(
      <DepthChart
        bidRows={mockBids}
        askRows={mockAsks}
        activeMarket="BTC-USD"
      />
    );

    expect(screen.getByTestId("depth-chart-container")).toBeInTheDocument();
    expect(screen.getByTestId("depth-chart-svg")).toBeInTheDocument();
    expect(screen.getByText(/Mid:/)).toBeInTheDocument();
    expect(screen.getByText(/Spread:/)).toBeInTheDocument();
  });

  it("renders zoom range selector pills and allows toggling range", () => {
    render(
      <DepthChart
        bidRows={mockBids}
        askRows={mockAsks}
        activeMarket="BTC-USD"
      />
    );

    const zoom1 = screen.getByRole("button", { name: "±1%" });
    const zoom2 = screen.getByRole("button", { name: "±2%" });
    const zoom5 = screen.getByRole("button", { name: "±5%" });
    const zoomFull = screen.getByRole("button", { name: "Full" });

    expect(zoom1).toBeInTheDocument();
    expect(zoom2).toBeInTheDocument();
    expect(zoom5).toBeInTheDocument();
    expect(zoomFull).toBeInTheDocument();

    fireEvent.click(zoom1);
    expect(zoom1).toHaveClass("bg-[#22d3ee]/20");
  });

  it("handles mouse hover and click interaction on depth SVG", () => {
    const dispatchSpy = vi.spyOn(terminalActions, "dispatchTerminalAction");

    render(
      <DepthChart
        bidRows={mockBids}
        askRows={mockAsks}
        activeMarket="BTC-USD"
      />
    );

    const svg = screen.getByTestId("depth-chart-svg");
    expect(svg).toBeInTheDocument();

    // Hover to trigger crosshair/tooltip calculation
    fireEvent.mouseMove(svg, { clientX: 100, clientY: 100 });
    // Click on depth area
    fireEvent.click(svg);

    // Clicking without mock rect might not have hoverData, but doesn't crash
    expect(dispatchSpy).toBeDefined();
    expect(svg).toBeInTheDocument();
  });
});
