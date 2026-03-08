import { useEffect } from "react";
import { useUIStore, getEffectiveTheme } from "@/store/uiStore";

export function useTheme() {
  const { theme, setTheme, toggleTheme } = useUIStore();

  // Get effective theme (resolves "system" to actual theme)
  const effectiveTheme = getEffectiveTheme(theme);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      // Theme will be automatically re-calculated on next render
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  return {
    theme,
    effectiveTheme,
    setTheme,
    toggleTheme,
    isDark: effectiveTheme === "dark",
    isLight: effectiveTheme === "light",
  };
}

// Hook for keyboard shortcut to toggle theme
export function useThemeKeyboardShortcut() {
  const { toggleTheme } = useTheme();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + T to toggle theme
      if ((e.ctrlKey || e.metaKey) && e.key === "t") {
        e.preventDefault();
        toggleTheme();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleTheme]);
}
