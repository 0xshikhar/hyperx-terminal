import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { KeyboardShortcutsModal } from "../KeyboardShortcutsModal";

describe("KeyboardShortcutsModal", () => {
  it("renders categorized shortcuts when open", () => {
    render(<KeyboardShortcutsModal open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Keyboard Shortcuts")).toBeInTheDocument();
    expect(screen.getByText("Order Entry & Types")).toBeInTheDocument();
    expect(screen.getByText("Emergency & Position Actions")).toBeInTheDocument();
    expect(screen.getByText("Navigation & Workspace")).toBeInTheDocument();
  });

  it("displays panic cancel shortcut with Shift and C badges", () => {
    render(<KeyboardShortcutsModal open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText(/Panic Cancel All Open Orders/i)).toBeInTheDocument();
    expect(screen.getByText("Panic")).toBeInTheDocument();
    expect(screen.getByText("Shift")).toBeInTheDocument();
  });

  it("displays market selector hotkey ⌘ and K", () => {
    render(<KeyboardShortcutsModal open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText(/Open Market Selector/i)).toBeInTheDocument();
    expect(screen.getByText("⌘")).toBeInTheDocument();
    expect(screen.getByText("K")).toBeInTheDocument();
  });

  it("renders close button and triggers onOpenChange", () => {
    const onOpenChange = vi.fn();
    render(<KeyboardShortcutsModal open={true} onOpenChange={onOpenChange} />);

    const closeBtn = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
