import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Keyboard, Zap, AlertTriangle, Compass } from "lucide-react";

type KeyboardShortcutsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

interface ShortcutRow {
  keys: string[];
  description: string;
  badge?: string;
  badgeTone?: "cyan" | "emerald" | "amber" | "rose";
}

interface ShortcutCategory {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcuts: ShortcutRow[];
}

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    title: "Order Entry & Types",
    icon: Zap,
    shortcuts: [
      { keys: ["B"], description: "Prepare Buy / Long order & focus size" },
      { keys: ["S"], description: "Prepare Sell / Short order & focus size" },
      { keys: ["M"], description: "Switch to Market order type" },
      { keys: ["L"], description: "Switch to Limit order type" },
      { keys: ["1", "2", "3", "4"], description: "Set size to 25%, 50%, 75%, 100%" },
    ],
  },
  {
    title: "Emergency & Position Actions",
    icon: AlertTriangle,
    shortcuts: [
      {
        keys: ["Shift", "C"],
        description: "🚨 Panic Cancel All Open Orders immediately",
        badge: "Panic",
        badgeTone: "rose",
      },
      {
        keys: ["C"],
        description: "Close current market position at market",
        badge: "Fast Exit",
        badgeTone: "amber",
      },
    ],
  },
  {
    title: "Navigation & Workspace",
    icon: Compass,
    shortcuts: [
      {
        keys: ["⌘", "K"],
        description: "Open Market Selector & Search palette",
        badge: "Global",
        badgeTone: "cyan",
      },
      {
        keys: ["F"],
        description: "Toggle Chart Fullscreen view",
        badge: "Chart",
        badgeTone: "cyan",
      },
      {
        keys: ["Alt", "R"],
        description: "Reset Workspace Layout to default split",
        badge: "Layout",
        badgeTone: "amber",
      },
      { keys: ["?"], description: "Toggle this Keyboard Shortcuts HUD" },
      { keys: ["Esc"], description: "Close any modal or exit fullscreen" },
    ],
  },
];

export function KeyboardShortcutsModal({ open, onOpenChange }: KeyboardShortcutsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border-[#1a2d32] bg-[#071316]/95 backdrop-blur-xl p-0 text-[#c8d4d7] shadow-2xl sm:rounded-xl overflow-hidden">
        <DialogHeader className="border-b border-[#142327] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#10272d] border border-[#1b3f49] text-[#22d3ee]">
              <Keyboard className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-white">
                Keyboard Shortcuts
              </DialogTitle>
              <DialogDescription className="text-xs text-[#627a80]">
                Pro hotkeys for institutional scalping & rapid terminal navigation
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[440px] overflow-y-auto px-5 py-3 divide-y divide-[#102024]">
          {SHORTCUT_CATEGORIES.map((category) => {
            const Icon = category.icon;
            return (
              <div key={category.title} className="py-3.5 first:pt-1 last:pb-1">
                <div className="flex items-center gap-2 mb-2.5">
                  <Icon className="h-3.5 w-3.5 text-[#22d3ee]" />
                  <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-[#8ea2a6]">
                    {category.title}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {category.shortcuts.map((s, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-[#0a181b] transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#c8d4d7]">{s.description}</span>
                        {s.badge && (
                          <span
                            className={`rounded px-1.5 py-0.2 text-[9px] font-bold font-mono uppercase border ${
                              s.badgeTone === "rose"
                                ? "border-[#ff4757]/40 bg-[#ff4757]/10 text-[#ff4757]"
                                : s.badgeTone === "amber"
                                  ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                                  : "border-[#22d3ee]/40 bg-[#22d3ee]/10 text-[#22d3ee]"
                            }`}
                          >
                            {s.badge}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {s.keys.map((k, kIdx) => (
                          <kbd
                            key={kIdx}
                            className="flex h-5 min-w-[20px] items-center justify-center rounded border border-[#1f3137] bg-[#0c191c] px-1.5 font-mono text-[11px] font-semibold text-white shadow-sm"
                          >
                            {k}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-[#142327] bg-[#081215] px-5 py-2.5 flex items-center justify-between text-[11px] text-[#556b73]">
          <span>Tip: Shortcuts are active whenever input fields are not focused.</span>
          <kbd className="rounded border border-[#1f3137] bg-[#0c191c] px-1.5 py-0.5 font-mono text-[#8aa1a7]">
            Esc to close
          </kbd>
        </div>
      </DialogContent>
    </Dialog>
  );
}
