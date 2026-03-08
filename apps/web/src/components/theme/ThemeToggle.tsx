import { motion } from "framer-motion";
import { Moon, Sun, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();

  const themes = [
    { value: "light", icon: Sun, label: "Light" },
    { value: "dark", icon: Moon, label: "Dark" },
    { value: "system", icon: Monitor, label: "Auto" },
  ];

  return (
    <div className={cn("flex items-center gap-1 p-1 rounded-lg bg-secondary/50 border border-border/50", className)}>
      {themes.map((t) => {
        const Icon = t.icon;
        const isActive = theme === t.value;

        return (
          <button
            key={t.value}
            onClick={() => setTheme(t.value as "light" | "dark" | "system")}
            className={cn(
              "relative flex items-center justify-center w-8 h-8 rounded-md transition-all duration-200",
              isActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
            title={`${t.label} mode`}
          >
            {isActive && (
              <motion.div
                layoutId="theme-indicator"
                className="absolute inset-0 rounded-md bg-primary/10 border border-primary/30"
                transition={{ type: "spring", duration: 0.5 }}
              />
            )}
            <Icon className="h-4 w-4 relative z-10" />
          </button>
        );
      })}
    </div>
  );
}

// Simple toggle switch version
export function ThemeToggleSwitch({ className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        isDark ? "bg-primary/20" : "bg-secondary",
        className
      )}
    >
      <span className="sr-only">Toggle theme</span>
      <motion.div
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full shadow-lg",
          isDark ? "bg-primary" : "bg-background"
        )}
        animate={{
          x: isDark ? 24 : 4,
          rotate: isDark ? 360 : 0,
        }}
        transition={{
          type: "spring",
          stiffness: 500,
          damping: 30,
        }}
      >
        {isDark ? (
          <Moon className="h-3 w-3 text-primary-foreground" />
        ) : (
          <Sun className="h-3 w-3 text-foreground" />
        )}
      </motion.div>
    </button>
  );
}

// Animated icon version
export function ThemeToggleAnimated({ className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "relative p-2 rounded-lg hover:bg-secondary transition-colors",
        className
      )}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <div className="relative h-5 w-5">
        <motion.div
          initial={false}
          animate={{
            scale: isDark ? 0 : 1,
            opacity: isDark ? 0 : 1,
            rotate: isDark ? -90 : 0,
          }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0"
        >
          <Sun className="h-5 w-5 text-foreground" />
        </motion.div>
        <motion.div
          initial={false}
          animate={{
            scale: isDark ? 1 : 0,
            opacity: isDark ? 1 : 0,
            rotate: isDark ? 0 : 90,
          }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0"
        >
          <Moon className="h-5 w-5 text-primary" />
        </motion.div>
      </div>
    </button>
  );
}
