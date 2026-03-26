import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TradingChart } from "../TradingChart";

const mockSetData = vi.fn();
const mockUpdate = vi.fn();
const mockFitContent = vi.fn();

const mockSeries = {
  setData: mockSetData,
  update: mockUpdate,
  coordinateToPrice: vi.fn(() => 76000),
  priceToCoordinate: vi.fn(() => 100),
};

const mockChart = {
  applyOptions: vi.fn(),
  addCandlestickSeries: vi.fn(() => mockSeries),
  timeScale: vi.fn(() => ({
    fitContent: mockFitContent,
    subscribeVisibleLogicalRangeChange: vi.fn(),
    unsubscribeVisibleLogicalRangeChange: vi.fn(),
    coordinateToTime: vi.fn(() => 1710000000),
    timeToCoordinate: vi.fn(() => 50),
  })),
  remove: vi.fn(),
};

vi.mock("lightweight-charts", () => ({
  createChart: vi.fn(() => mockChart),
}));

let mockCandles = [
  { time: 1710000000, open: 76000, high: 76100, low: 75900, close: 76050 },
  { time: 1710000060, open: 76050, high: 76200, low: 76000, close: 76150 },
];

vi.mock("@/hooks/useCandleStream", () => ({
  useCandleStream: () => ({
    candles: mockCandles,
    latest: mockCandles[mockCandles.length - 1],
    isReference: false,
  }),
}));

vi.mock("@/store/marketStore", () => ({
  useMarketStore: (selector: (state: { activeMarket: string }) => unknown) =>
    selector({ activeMarket: "BTC-USD" }),
}));

vi.mock("@/store/runtimeHealthStore", () => ({
  useRuntimeHealthStore: (selector: (state: { connectionState: string }) => unknown) =>
    selector({ connectionState: "connected" }),
}));

describe("TradingChart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders active market and timeframe indicator header", () => {
    render(<TradingChart interval="1m" />);
    expect(screen.getByText("BTC-USD · 1M")).toBeInTheDocument();
  });

  it("calls series.setData on initial load", () => {
    render(<TradingChart interval="1m" />);
    expect(mockSetData).toHaveBeenCalledTimes(1);
    expect(mockFitContent).toHaveBeenCalledTimes(1);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("calls series.update instead of series.setData on streaming candle updates", () => {
    const { rerender } = render(<TradingChart interval="1m" />);
    expect(mockSetData).toHaveBeenCalledTimes(1);

    // Simulate incoming price tick on the active bar
    mockCandles = [
      mockCandles[0],
      { time: 1710000060, open: 76050, high: 76250, low: 76000, close: 76220 },
    ];

    rerender(<TradingChart interval="1m" />);

    // series.update should have been called in O(1) time
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith({
      time: 1710000060,
      open: 76050,
      high: 76250,
      low: 76000,
      close: 76220,
    });

    // series.setData should STILL have been called only once!
    expect(mockSetData).toHaveBeenCalledTimes(1);
  });
});
