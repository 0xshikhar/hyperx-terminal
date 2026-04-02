import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LeverageMarginModal } from "../LeverageMarginModal";
import { useMarginSettingsStore } from "@/store/marginSettingsStore";

describe("LeverageMarginModal", () => {
  beforeEach(() => {
    useMarginSettingsStore.setState({
      marginMode: "cross",
      leverage: 10,
      marketLeverage: {},
    });
  });

  it("renders modal with Cross and Isolated mode options and leverage presets", () => {
    render(<LeverageMarginModal open={true} onOpenChange={vi.fn()} market="BTC-USD" />);

    expect(screen.getByText("MARGIN MODE & LEVERAGE")).toBeInTheDocument();
    expect(screen.getByText("CROSS")).toBeInTheDocument();
    expect(screen.getByText("ISOLATED")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "10x" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "20x" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "50x" })).toBeInTheDocument();
    expect(screen.getByText("CONFIRM CROSS 10X")).toBeInTheDocument();
  });

  it("switches margin mode to ISOLATED when clicked", () => {
    render(<LeverageMarginModal open={true} onOpenChange={vi.fn()} market="BTC-USD" />);

    const isolatedBtn = screen.getByText("ISOLATED");
    fireEvent.click(isolatedBtn);

    expect(screen.getByText("CONFIRM ISOLATED 10X")).toBeInTheDocument();
  });

  it("updates leverage when preset pill is clicked and updates confirmation button text", () => {
    render(<LeverageMarginModal open={true} onOpenChange={vi.fn()} market="BTC-USD" />);

    // Click 25x preset pill
    const preset25 = screen.getByRole("button", { name: "25x" });
    fireEvent.click(preset25);

    expect(screen.getByText("CONFIRM CROSS 25X")).toBeInTheDocument();
  });

  it("displays high leverage warning when leverage > 20x", () => {
    render(<LeverageMarginModal open={true} onOpenChange={vi.fn()} market="BTC-USD" />);

    // Select 50x
    const preset50 = screen.getByRole("button", { name: "50x" });
    fireEvent.click(preset50);

    expect(screen.getByText("High Leverage Warning:")).toBeInTheDocument();
  });

  it("saves margin mode and leverage to store on confirm", () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <LeverageMarginModal
        open={true}
        onOpenChange={onOpenChange}
        market="BTC-USD"
        onConfirm={onConfirm}
      />
    );

    // Switch to Isolated
    fireEvent.click(screen.getByText("ISOLATED"));

    // Select 20x
    fireEvent.click(screen.getByRole("button", { name: "20x" }));

    // Confirm
    const confirmBtn = screen.getByText("CONFIRM ISOLATED 20X");
    fireEvent.click(confirmBtn);

    expect(useMarginSettingsStore.getState().marginMode).toBe("isolated");
    expect(useMarginSettingsStore.getState().getLeverage("BTC-USD")).toBe(20);
    expect(onConfirm).toHaveBeenCalledWith("isolated", 20);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
