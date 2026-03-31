import { describe, it, expect, beforeEach } from "vitest";
import { terminalAudio } from "@/lib/terminalAudio";

describe("terminalAudio", () => {
  beforeEach(() => {
    terminalAudio.setEnabled(true);
  });

  it("toggles enabled state correctly", () => {
    expect(terminalAudio.isEnabled()).toBe(true);
    const next = terminalAudio.toggle();
    expect(next).toBe(false);
    expect(terminalAudio.isEnabled()).toBe(false);
    const reenabled = terminalAudio.toggle();
    expect(reenabled).toBe(true);
    expect(terminalAudio.isEnabled()).toBe(true);
  });

  it("handles sound methods safely without crashing", () => {
    expect(() => {
      terminalAudio.playClick();
      terminalAudio.playOrderSubmit();
      terminalAudio.playOrderFill();
      terminalAudio.playOrderCancel();
      terminalAudio.playAlert();
    }).not.toThrow();
  });
});
