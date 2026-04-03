import { describe, it, expect, beforeEach } from "vitest";
import { useLayoutStore } from "@/store/layoutStore";

describe("layoutStore", () => {
  beforeEach(() => {
    useLayoutStore.setState({
      isFullscreenChart: false,
      layoutPreset: "default",
      layoutVersion: 0,
    });
    localStorage.clear();
  });

  it("initializes with default settings", () => {
    const state = useLayoutStore.getState();
    expect(state.isFullscreenChart).toBe(false);
    expect(state.layoutPreset).toBe("default");
    expect(state.layoutVersion).toBe(0);
  });

  it("toggles fullscreen chart state", () => {
    useLayoutStore.getState().toggleFullscreenChart();
    expect(useLayoutStore.getState().isFullscreenChart).toBe(true);

    useLayoutStore.getState().setFullscreenChart(false);
    expect(useLayoutStore.getState().isFullscreenChart).toBe(false);
  });

  it("applies scalper and depth presets and increments layoutVersion", () => {
    useLayoutStore.getState().setLayoutPreset("scalper");
    expect(useLayoutStore.getState().layoutPreset).toBe("scalper");
    expect(useLayoutStore.getState().layoutVersion).toBe(1);

    expect(localStorage.getItem("hyperx-terminal-panels-main")).toBe(
      JSON.stringify([82, 18])
    );

    useLayoutStore.getState().setLayoutPreset("depth");
    expect(useLayoutStore.getState().layoutPreset).toBe("depth");
    expect(useLayoutStore.getState().layoutVersion).toBe(2);

    expect(localStorage.getItem("hyperx-terminal-panels-top")).toBe(
      JSON.stringify([50, 50])
    );
  });

  it("resets layout to default and clears panel storage keys", () => {
    useLayoutStore.getState().setLayoutPreset("scalper");
    useLayoutStore.getState().setFullscreenChart(true);

    useLayoutStore.getState().resetLayout();

    expect(useLayoutStore.getState().layoutPreset).toBe("default");
    expect(useLayoutStore.getState().isFullscreenChart).toBe(false);
    expect(useLayoutStore.getState().layoutVersion).toBe(2);

    expect(localStorage.getItem("hyperx-terminal-panels-main")).toBeNull();
  });
});
