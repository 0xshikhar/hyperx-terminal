import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DiagnosticsModal } from "../DiagnosticsModal";
import { useLatencyStore } from "@/store/latencyStore";
import { useRenderMetricsStore } from "@/store/renderMetricsStore";

describe("DiagnosticsModal", () => {
  beforeEach(() => {
    useLatencyStore.setState({
      latency: {
        wsPing: 16,
        apiLatency: 35,
        lastUpdate: Date.now(),
        wsHistory: [
          { timestamp: Date.now() - 1000, value: 16 },
          { timestamp: Date.now() - 500, value: 18 },
        ],
        apiHistory: [],
      },
    });
    useRenderMetricsStore.setState({
      fps: 60,
    });
  });

  it("renders diagnostics modal with RTT, FPS gauge, RPC health, and active subscriptions", () => {
    render(<DiagnosticsModal open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByTestId("diagnostics-modal")).toBeInTheDocument();
    expect(screen.getByText("System Diagnostics & Execution Speedometer")).toBeInTheDocument();
    expect(screen.getByText("SYSTEM OPTIMAL")).toBeInTheDocument();
    expect(screen.getByText("WS Ping (RTT)")).toBeInTheDocument();
    expect(screen.getByText("Frame Pacing")).toBeInTheDocument();
    expect(screen.getByText("Starknet RPC")).toBeInTheDocument();
    expect(screen.getByText("Parse Latency")).toBeInTheDocument();
    expect(screen.getByText("Active Feed Subscriptions")).toBeInTheDocument();
  });

  it("triggers diagnostic ping test on button click", async () => {
    render(<DiagnosticsModal open={true} onOpenChange={vi.fn()} />);

    const pingBtn = screen.getByRole("button", { name: /run ping test/i });
    expect(pingBtn).toBeInTheDocument();

    fireEvent.click(pingBtn);

    expect(screen.getByText(/pinging/i)).toBeInTheDocument();

    await waitFor(
      () => {
        expect(screen.getByRole("button", { name: /run ping test/i })).toBeInTheDocument();
      },
      { timeout: 1000 }
    );
  });

  it("copies telemetry report to clipboard", () => {
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextSpy,
      },
    });

    render(<DiagnosticsModal open={true} onOpenChange={vi.fn()} />);

    const copyBtn = screen.getByRole("button", { name: /copy diagnostics/i });
    fireEvent.click(copyBtn);

    expect(writeTextSpy).toHaveBeenCalled();
  });
});
