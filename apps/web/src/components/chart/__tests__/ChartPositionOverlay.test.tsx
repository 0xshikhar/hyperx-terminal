import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChartPositionOverlay } from "@/components/chart/ChartPositionOverlay";
import { usePaperTradingStore } from "@/store/paperTradingStore";
import type { IChartApi, IPriceLine, ISeriesApi } from "lightweight-charts";

describe("ChartPositionOverlay (Interactive Chart Trading)", () => {
  let mockPriceLine: IPriceLine;
  let mockSeries: Partial<ISeriesApi<"Candlestick">>;
  let mockChart: Partial<IChartApi>;

  beforeEach(() => {
    mockPriceLine = {
      applyOptions: vi.fn(),
      options: vi.fn(),
    } as unknown as IPriceLine;

    mockSeries = {
      createPriceLine: vi.fn().mockReturnValue(mockPriceLine),
      removePriceLine: vi.fn(),
      priceToCoordinate: vi.fn().mockImplementation((price: number) => {
        // Return simulated Y pixel coordinate
        return price > 70000 ? 150 : 250;
      }),
    };

    mockChart = {
      timeScale: vi.fn().mockReturnValue({
        subscribeVisibleLogicalRangeChange: vi.fn(),
        unsubscribeVisibleLogicalRangeChange: vi.fn(),
      }),
    };

    // Reset paper trading store with test position and open order
    usePaperTradingStore.setState({
      positions: [
        {
          id: "pos-btc-1",
          market: "BTC-USD",
          side: "long",
          size: 0.5,
          entryPrice: 76000,
          markPrice: 77500,
          pnl: 750,
          pnlPercent: 19.74,
          margin: 3800,
          leverage: 10,
          openedAt: "2026-09-19T00:00:00Z",
        },
      ],
      openOrders: [
        {
          id: "ord-btc-1",
          market: "BTC-USD",
          side: "buy",
          type: "limit",
          size: 0.25,
          price: 74000,
          filledSize: 0,
          status: "open",
          createdAt: 1710000000000,
          updatedAt: 1710000000000,
          source: "api",
        },
      ],
    });
  });

  it("creates price lines on chart series for active position and limit order", () => {
    render(
      <ChartPositionOverlay
        market="BTC-USD"
        series={mockSeries as ISeriesApi<"Candlestick">}
        chart={mockChart as IChartApi}
      />
    );

    // Should create 3 lines: Position entry line, Position liquidation line, Order price line
    expect(mockSeries.createPriceLine).toHaveBeenCalledTimes(3);
  });

  it("renders interactive action chips with 1-click execution on chart", () => {
    render(
      <ChartPositionOverlay
        market="BTC-USD"
        series={mockSeries as ISeriesApi<"Candlestick">}
        chart={mockChart as IChartApi}
      />
    );

    // Position chip should be in DOM with live metrics
    expect(screen.getByText(/long 0.5000/i)).toBeInTheDocument();
    expect(screen.getByText(/\+\$750\.00/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument();

    // Liquidation chip
    expect(screen.getByText(/liq:/i)).toBeInTheDocument();

    // Order chip with Cancel button
    expect(screen.getByText(/buy limit/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("triggers market close when Close button on chart chip is clicked", () => {
    const closeSpy = vi.spyOn(usePaperTradingStore.getState(), "closePosition");

    render(
      <ChartPositionOverlay
        market="BTC-USD"
        series={mockSeries as ISeriesApi<"Candlestick">}
        chart={mockChart as IChartApi}
      />
    );

    const closeBtn = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeBtn);

    expect(closeSpy).toHaveBeenCalledWith("pos-btc-1");
  });

  it("triggers cancel order when Cancel button on chart chip is clicked", () => {
    const cancelSpy = vi.spyOn(usePaperTradingStore.getState(), "cancelOrder");

    render(
      <ChartPositionOverlay
        market="BTC-USD"
        series={mockSeries as ISeriesApi<"Candlestick">}
        chart={mockChart as IChartApi}
      />
    );

    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelBtn);

    expect(cancelSpy).toHaveBeenCalledWith("ord-btc-1");
  });

  it("cleans up price lines when component unmounts", () => {
    const { unmount } = render(
      <ChartPositionOverlay
        market="BTC-USD"
        series={mockSeries as ISeriesApi<"Candlestick">}
        chart={mockChart as IChartApi}
      />
    );

    unmount();
    expect(mockSeries.removePriceLine).toHaveBeenCalled();
  });

  it("renders TP and SL price lines and interactive chips with cancellation", () => {
    usePaperTradingStore.setState({
      positions: [
        {
          id: "pos-btc-1",
          market: "BTC-USD",
          side: "long",
          size: 0.5,
          entryPrice: 76000,
          markPrice: 77500,
          pnl: 750,
          pnlPercent: 19.74,
          margin: 3800,
          leverage: 10,
          openedAt: "2026-09-19T00:00:00Z",
          takeProfit: 80000,
          stopLoss: 74000,
        },
      ],
      openOrders: [],
    });

    render(
      <ChartPositionOverlay
        market="BTC-USD"
        series={mockSeries as ISeriesApi<"Candlestick">}
        chart={mockChart as IChartApi}
      />
    );

    // Verify TP price line created
    expect(mockSeries.createPriceLine).toHaveBeenCalledWith(
      expect.objectContaining({
        price: 80000,
        color: "#00d084",
        lineStyle: 1,
      })
    );

    // Verify SL price line created
    expect(mockSeries.createPriceLine).toHaveBeenCalledWith(
      expect.objectContaining({
        price: 74000,
        color: "#ff4757",
        lineStyle: 1,
      })
    );

    // Verify chips rendered
    expect(screen.getByText("TP:")).toBeInTheDocument();
    expect(screen.getByText("SL:")).toBeInTheDocument();
    expect(screen.getByTitle("Cancel Take-Profit")).toBeInTheDocument();
    expect(screen.getByTitle("Cancel Stop-Loss")).toBeInTheDocument();

    // Click cancel TP
    fireEvent.click(screen.getByTitle("Cancel Take-Profit"));
    const updated = usePaperTradingStore.getState().positions.find((p) => p.id === "pos-btc-1");
    expect(updated?.takeProfit).toBeUndefined();
    expect(updated?.stopLoss).toBe(74000);
  });
});
