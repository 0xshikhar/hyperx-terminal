import { createContext, useContext, useState, useCallback, useEffect } from "react";

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  description: string;
  action: () => void;
  scope?: "global" | "terminal" | "chart";
}

interface KeyboardShortcutsContextType {
  shortcuts: Map<string, KeyboardShortcut>;
  registerShortcut: (shortcut: KeyboardShortcut) => void;
  unregisterShortcut: (key: string) => void;
  getShortcutsByScope: (scope: KeyboardShortcut["scope"]) => KeyboardShortcut[];
  showHelp: boolean;
  setShowHelp: (show: boolean) => void;
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextType | null>(null);

export function useKeyboardShortcuts() {
  const context = useContext(KeyboardShortcutsContext);
  if (!context) {
    throw new Error("useKeyboardShortcuts must be used within KeyboardShortcutsProvider");
  }
  return context;
}

export function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
  const [shortcuts, setShortcuts] = useState<Map<string, KeyboardShortcut>>(new Map());
  const [showHelp, setShowHelp] = useState(false);

  const getShortcutKey = useCallback((shortcut: KeyboardShortcut) => {
    const parts: string[] = [];
    if (shortcut.ctrlKey) parts.push("ctrl");
    if (shortcut.shiftKey) parts.push("shift");
    if (shortcut.altKey) parts.push("alt");
    if (shortcut.metaKey) parts.push("meta");
    parts.push(shortcut.key.toLowerCase());
    return parts.join("+");
  }, []);

  const registerShortcut = useCallback((shortcut: KeyboardShortcut) => {
    const key = getShortcutKey(shortcut);
    setShortcuts((prev) => {
      const next = new Map(prev);
      next.set(key, shortcut);
      return next;
    });
  }, [getShortcutKey]);

  const unregisterShortcut = useCallback((key: string) => {
    setShortcuts((prev) => {
      const next = new Map(prev);
      next.delete(key.toLowerCase());
      return next;
    });
  }, []);

  const getShortcutsByScope = useCallback((scope: KeyboardShortcut["scope"]) => {
    return Array.from(shortcuts.values()).filter((s) => s.scope === scope || s.scope === "global");
  }, [shortcuts]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        // Allow escape key even in inputs
        if (e.key !== "Escape") return;
      }

      const parts: string[] = [];
      if (e.ctrlKey) parts.push("ctrl");
      if (e.shiftKey) parts.push("shift");
      if (e.altKey) parts.push("alt");
      if (e.metaKey) parts.push("meta");
      parts.push(e.key.toLowerCase());
      const key = parts.join("+");

      const shortcut = shortcuts.get(key);
      if (shortcut) {
        e.preventDefault();
        shortcut.action();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts]);

  return (
    <KeyboardShortcutsContext.Provider
      value={{
        shortcuts,
        registerShortcut,
        unregisterShortcut,
        getShortcutsByScope,
        showHelp,
        setShowHelp,
      }}
    >
      {children}
    </KeyboardShortcutsContext.Provider>
  );
}
