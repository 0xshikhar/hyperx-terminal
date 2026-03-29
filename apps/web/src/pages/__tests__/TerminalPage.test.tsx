import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { TerminalPage } from "../TerminalPage";
import { useMarketStore } from "@/store/marketStore";

vi.mock("@/hooks/useVimNavigation", () => ({
  useVimNavigation: vi.fn(),
}));

vi.mock("@/hooks/usePaperTradingSync", () => ({
  usePaperTradingSync: vi.fn(),
}));

vi.mock("@/components/chart/TradingChart", () => ({
  TradingChart: () => <div data-testid="trading-chart">Chart</div>,
}));

vi.mock("@/components/orderbook/OrderBook", () => ({
  OrderBook: () => <div data-testid="order-book">OrderBook</div>,
}));

vi.mock("@/components/recent-trades/RecentTrades", () => ({
  RecentTrades: () => <div data-testid="recent-trades">RecentTrades</div>,
}));

vi.mock("@/components/trade-form/TradeForm", () => ({
  TradeForm: () => <div data-testid="trade-form">TradeForm</div>,
}));

vi.mock("@/components/positions/PositionsTabs", () => ({
  PositionsTabs: () => <div data-testid="positions-tabs">PositionsTabs</div>,
}));

describe("TerminalPage Re-render Isolation", () => {
  beforeEach(() => {
    useMarketStore.setState({
      activeMarket: "BTC-USD",
      markets: [
        {
          symbol: "BTC-USD",
          displaySymbol: "BTC-USD",
          name: "Bitcoin",
          lastPrice: 76400.0,
          markPrice: 76400.0,
          oraclePrice: 76380.0,
          changePercent24h: 1.25,
          volume24h: 133797251,
          openInterest: 50.3,
          fundingRate: 0.000086,
        },
        {
          symbol: "ETH-USD",
          displaySymbol: "ETH-USD",
          name: "Ethereum",
          lastPrice: 2440.0,
          markPrice: 2440.0,
          oraclePrice: 2439.0,
          changePercent24h: 2.15,
          volume24h: 6783600,
          openInterest: 567.8,
          fundingRate: 0.000077,
        },
      ],
    });
  });

  it("renders market header price, quick switcher, and stat cards", () => {
    render(<TerminalPage />);

    expect(screen.getByTestId("header-last-price")).toHaveTextContent("$76,400.00");
    expect(screen.getByTestId("header-change-percent")).toHaveTextContent("+1.25%");
    expect(screen.getByText("Mark")).toBeInTheDocument();
    expect(screen.getByText("Oracle")).toBeInTheDocument();
  });

  it("updates header price when active market price ticks", () => {
    render(<TerminalPage />);

    expect(screen.getByTestId("header-last-price")).toHaveTextContent("$76,400.00");

    act(() => {
      useMarketStore.getState().updateMarket("BTC-USD", {
        lastPrice: 76550.0,
        changePercent24h: 1.45,
      });
    });

    expect(screen.getByTestId("header-last-price")).toHaveTextContent("$76,550.00");
    expect(screen.getByTestId("header-change-percent")).toHaveTextContent("+1.45%");
  });

  it("does not alter active market price when another market ticks", () => {
    render(<TerminalPage />);

    expect(screen.getByTestId("header-last-price")).toHaveTextContent("$76,400.00");

    act(() => {
      useMarketStore.getState().updateMarket("ETH-USD", {
        lastPrice: 2500.0,
        changePercent24h: 4.5,
      });
    });

    // Active market BTC-USD price must remain completely unchanged
    expect(screen.getByTestId("header-last-price")).toHaveTextContent("$76,400.00");
    expect(screen.getByTestId("header-change-percent")).toHaveTextContent("+1.25%");
  });
});
