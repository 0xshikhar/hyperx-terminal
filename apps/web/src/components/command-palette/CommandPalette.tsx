import { useState, useEffect, useCallback } from "react";
import { Command } from "cmdk";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Home,
  Wallet,
  Moon,
  Sun,
  Zap,
  Bell,
  Command as CommandIcon,
  LogOut,
  Keyboard,
  BarChart3,
  Trophy,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useTheme } from "@/hooks/useTheme";
import { useWallet } from "@/components/wallet/useWallet";
import { logout } from "@/services/auth.service";
import { toast } from "sonner";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CommandItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
  keywords?: string[];
  category: string;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const { theme, toggleTheme } = useTheme();
  const { isConnected, disconnectWallet } = useWallet();

  const commands: CommandItem[] = [
    // Navigation
    {
      id: "go-home",
      label: "Go to Trading Terminal",
      icon: <Home className="h-4 w-4" />,
      shortcut: "G T",
      action: () => navigate("/terminal"),
      keywords: ["home", "trade", "terminal"],
      category: "Navigation",
    },
    {
      id: "go-markets",
      label: "Go to Markets",
      icon: <BarChart3 className="h-4 w-4" />,
      shortcut: "G M",
      action: () => navigate("/markets"),
      keywords: ["markets", "market", "prices"],
      category: "Navigation",
    },
    {
      id: "go-portfolio",
      label: "Go to Portfolio",
      icon: <Wallet className="h-4 w-4" />,
      shortcut: "G P",
      action: () => navigate("/portfolio"),
      keywords: ["portfolio", "positions", "orders"],
      category: "Navigation",
    },
    {
      id: "go-leaderboard",
      label: "Go to Leaderboard",
      icon: <Trophy className="h-4 w-4" />,
      shortcut: "G L",
      action: () => navigate("/leaderboard"),
      keywords: ["leaderboard", "ranking", "leaders"],
      category: "Navigation",
    },

    // Actions
    {
      id: "toggle-theme",
      label: theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode",
      icon: theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />,
      shortcut: "⌘ T",
      action: () => {
        toggleTheme();
        toast.success(`Switched to ${theme === "dark" ? "light" : "dark"} mode`);
      },
      keywords: ["theme", "dark", "light", "mode", "toggle"],
      category: "Preferences",
    },
    {
      id: "notifications",
      label: "Open Notifications",
      icon: <Bell className="h-4 w-4" />,
      shortcut: "⌘ N",
      action: () => toast.info("Notifications panel coming soon!"),
      keywords: ["notifications", "alerts", "bell"],
      category: "Actions",
    },
    {
      id: "keyboard-shortcuts",
      label: "View Keyboard Shortcuts",
      icon: <Keyboard className="h-4 w-4" />,
      shortcut: "?",
      action: () => {
        onOpenChange(false);
        toast.info("Press '?' to view all keyboard shortcuts");
      },
      keywords: ["keyboard", "shortcuts", "hotkeys", "help"],
      category: "Help",
    },

    // Wallet
    {
      id: "connect-wallet",
      label: "Connect Wallet",
      icon: <Zap className="h-4 w-4" />,
      action: () => {
        if (!isConnected) {
          navigate("/login");
        } else {
          toast.info("Wallet already connected");
        }
        onOpenChange(false);
      },
      keywords: ["wallet", "connect", "login", "starknet"],
      category: "Wallet",
    },
    {
      id: "disconnect-wallet",
      label: "Disconnect Wallet",
      icon: <LogOut className="h-4 w-4" />,
      action: async () => {
        await disconnectWallet();
        await logout();
        toast.success("Wallet disconnected");
        navigate("/login");
      },
      keywords: ["wallet", "disconnect", "logout"],
      category: "Wallet",
    },
  ];

  const filteredCommands = commands.filter((cmd) => {
    const searchLower = search.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(searchLower) ||
      cmd.category.toLowerCase().includes(searchLower) ||
      cmd.keywords?.some((k) => k.toLowerCase().includes(searchLower))
    );
  });

  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(true);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [onOpenChange]);

  const handleSelect = useCallback((cmd: CommandItem) => {
    cmd.action();
    onOpenChange(false);
    setSearch("");
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 overflow-hidden border border-border/50 bg-card/95 backdrop-blur-xl max-w-2xl">
        <Command
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]]:rounded-md [&_[cmdk-item]]:font-mono [&_[cmdk-item]]:text-sm"
        >
          <div className="flex items-center border-b border-border/50 px-3">
            <Search className="h-5 w-5 text-muted-foreground mr-2" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Type a command or search..."
              className="flex-1 bg-transparent border-0 outline-none placeholder:text-muted-foreground h-12 font-mono"
            />
            <kbd className="hidden md:inline-flex items-center gap-1 rounded border border-border/50 bg-secondary/50 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
              <CommandIcon className="h-3 w-3" />
              <span>K</span>
            </kbd>
          </div>

          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center font-mono text-sm text-muted-foreground">
              No commands found for "{search}"
            </Command.Empty>

            {Object.entries(groupedCommands).map(([category, items]) => (
              <Command.Group
                key={category}
                heading={category}
                className="px-2 py-2"
              >
                {items.map((cmd) => (
                  <Command.Item
                    key={cmd.id}
                    value={cmd.id}
                    onSelect={() => handleSelect(cmd)}
                    className="flex items-center justify-between px-2 py-2.5 cursor-pointer data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary hover:bg-secondary transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground group-data-[selected=true]:text-primary">
                        {cmd.icon}
                      </span>
                      <span>{cmd.label}</span>
                    </div>
                    {cmd.shortcut && (
                      <div className="flex items-center gap-1">
                        {cmd.shortcut.split(" ").map((key, i) => (
                          <kbd
                            key={i}
                            className="rounded border border-border/50 bg-secondary/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                          >
                            {key}
                          </kbd>
                        ))}
                      </div>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>

          <div className="border-t border-border/50 px-3 py-2 flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border/50 bg-secondary/50 px-1.5 py-0.5 font-mono">
                  ↑↓
                </kbd>
                <span>Navigate</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border/50 bg-secondary/50 px-1.5 py-0.5 font-mono">
                  ↵
                </kbd>
                <span>Select</span>
              </span>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-wider">
              {filteredCommands.length} commands
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
