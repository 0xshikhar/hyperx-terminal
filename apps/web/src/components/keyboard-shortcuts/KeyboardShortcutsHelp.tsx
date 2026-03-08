import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Command, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onClose: () => void;
}

interface ShortcutSection {
  title: string;
  shortcuts: {
    keys: string[];
    description: string;
  }[];
}

const shortcutSections: ShortcutSection[] = [
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["G", "T"], description: "Go to Trading Terminal" },
      { keys: ["G", "M"], description: "Go to Markets" },
      { keys: ["G", "P"], description: "Go to Portfolio" },
      { keys: ["G", "L"], description: "Go to Leaderboard" },
      { keys: ["Esc"], description: "Close modal / Cancel" },
    ],
  },
  {
    title: "Trading",
    shortcuts: [
      { keys: ["B"], description: "Focus Buy Side" },
      { keys: ["S"], description: "Focus Sell Side" },
      { keys: ["M"], description: "Market Order" },
      { keys: ["L"], description: "Limit Order" },
      { keys: ["Tab"], description: "Next Input Field" },
      { keys: ["Enter"], description: "Submit Order" },
    ],
  },
  {
    title: "Interface",
    shortcuts: [
      { keys: ["Ctrl", "K"], description: "Open Command Palette" },
      { keys: ["Ctrl", "T"], description: "Toggle Theme" },
      { keys: ["Ctrl", "N"], description: "Notifications" },
      { keys: ["?"], description: "Show/Hide Keyboard Shortcuts" },
      { keys: ["/"], description: "Search / Focus Search" },
    ],
  },
  {
    title: "Chart",
    shortcuts: [
      { keys: ["+"], description: "Zoom In" },
      { keys: ["-"], description: "Zoom Out" },
      { keys: ["←"], description: "Scroll Left" },
      { keys: ["→"], description: "Scroll Right" },
      { keys: ["1", "M"], description: "1 Minute Interval" },
      { keys: ["5", "M"], description: "5 Minute Interval" },
      { keys: ["1", "H"], description: "1 Hour Interval" },
      { keys: ["1", "D"], description: "1 Day Interval" },
    ],
  },
];

function Key({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded border border-border/50 bg-secondary/50 font-mono text-[10px] text-foreground shadow-sm",
        className
      )}
    >
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsHelp({ open, onClose }: KeyboardShortcutsHelpProps) {
  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="w-full max-w-3xl max-h-[80vh] overflow-hidden terminal-panel" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="terminal-header flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Command className="h-4 w-4 text-primary" />
                  <span className="font-mono text-sm font-medium">Keyboard Shortcuts</span>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded hover:bg-secondary transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {shortcutSections.map((section) => (
                    <div key={section.title} className="space-y-3">
                      <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                        {section.title}
                      </h3>
                      <div className="space-y-2">
                        {section.shortcuts.map((shortcut, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0"
                          >
                            <span className="font-mono text-sm text-foreground">
                              {shortcut.description}
                            </span>
                            <div className="flex items-center gap-1">
                              {shortcut.keys.map((key, keyIdx) => (
                                <span key={keyIdx} className="flex items-center gap-1">
                                  <Key>
                                    {key === "←" && <ArrowLeft className="h-3 w-3" />}
                                    {key === "→" && <ArrowRight className="h-3 w-3" />}
                                    {key === "↑" && <ArrowUp className="h-3 w-3" />}
                                    {key === "↓" && <ArrowDown className="h-3 w-3" />}
                                    {key === "Enter" && <CornerDownLeft className="h-3 w-3" />}
                                    {!["←", "→", "↑", "↓", "Enter"].includes(key) && key}
                                  </Key>
                                  {keyIdx < shortcut.keys.length - 1 && (
                                    <span className="text-muted-foreground">+</span>
                                  )}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-border/50 px-6 py-3 flex items-center justify-between text-xs text-muted-foreground bg-secondary/30">
                <span className="font-mono">Press <Key className="inline-flex">?</Key> to toggle this help</span>
                <span className="font-mono">HyperX Terminal v2.0</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
