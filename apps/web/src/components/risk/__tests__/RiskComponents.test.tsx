import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ADLIndicator } from "../ADLIndicator";
import { SettlementCountdown } from "../SettlementCountdown";
import { MarginRatioGauge } from "../MarginRatioGauge";

describe("ADLIndicator", () => {
  it("renders ADL label and 5 bar segments", () => {
    const { container } = render(<ADLIndicator priority={3} />);
    expect(screen.getByText("ADL")).toBeInTheDocument();
    // 5 bars rendered
    const bars = container.querySelectorAll(".rounded-\\[1px\\]");
    expect(bars.length).toBe(5);
  });
});

describe("MarginRatioGauge", () => {
  it("renders healthy gauge correctly", () => {
    render(
      <MarginRatioGauge
        marginRatio={15.4}
        riskTier="healthy"
        maintenanceMargin={500}
        equity={10000}
        freeMargin={9500}
      />
    );
    expect(screen.getByText("Margin Ratio")).toBeInTheDocument();
    expect(screen.getByText("HEALTHY")).toBeInTheDocument();
    expect(screen.getByText("15.40%")).toBeInTheDocument();
  });

  it("renders danger gauge with liq risk badge", () => {
    render(
      <MarginRatioGauge
        marginRatio={88.2}
        riskTier="danger"
        maintenanceMargin={4000}
        equity={4500}
        freeMargin={500}
      />
    );
    expect(screen.getByText("LIQ RISK")).toBeInTheDocument();
    expect(screen.getByText("88.20%")).toBeInTheDocument();
  });
});

describe("SettlementCountdown", () => {
  it("renders funding label, percentage, and countdown time format", () => {
    render(<SettlementCountdown fundingRate={0.000086} />);
    expect(screen.getByText("Funding / Countdown")).toBeInTheDocument();
    expect(screen.getByText("+0.0086%")).toBeInTheDocument();
    // Countdown format HH:MM:SS (e.g. 00:xx:xx)
    expect(screen.getByText(/^\d{2}:\d{2}:\d{2}$/)).toBeInTheDocument();
  });
});
