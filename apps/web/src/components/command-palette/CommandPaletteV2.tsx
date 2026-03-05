import { useCallback, useEffect, useMemo, useState } from "react";
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
  BookText,
  Scale,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useTheme } from "@/hooks/useTheme";
import { useWallet } from "@/components/wallet/useWallet";
import { logout } from "@/services/auth.service";
import { toast } from "sonner";
import { useMarketStore } from "@/store/marketStore";
import { dispatchTerminalAction } from "@/lib/terminalActions";

type CommandPaletteV2Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type CommandItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void | Promise<void>;
  keywords?: string[];
  category: string;
};

const RECENT_KEY = "hyperx-command-palette-recent";
const RECENT_LIMIT = 5;

const normalize = (value: string) => value.trim().toLowerCase();

const scoreCommand = (command: CommandItem, terms: string[]) => {
  if (terms.length === 0) return 1;

  const haystack = normalize(
    [command.label, command.category, command.shortcut, ...(command.keywords ?? [])].join(" ")
  );

  let score = 0;
  for (const term of terms) {
    if (!haystack.includes(term)) return 0;
    score += term.length;
    if (normalize(command.label).includes(term)) score += 2;
    if ((command.keywords ?? []).some((keyword) => normalize(keyword).includes(term))) {
      score += 1;
    }
  }

  return score / terms.length;
};

export function CommandPaletteV2({ open, onOpenChange }: CommandPaletteV2Props) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const { theme, toggleTheme } = useTheme();
  const { isConnected, disconnectWallet } = useWallet();
  const activeMarket = useMarketStore((state) => state.activeMarket);
  const markets = useMarketStore((state) => state.markets);
  const setActiveMarket = useMarketStore((state) => state.setActiveMarket);

  useEffect(() => {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as string[];
      setRecentIds(parsed.slice(0, RECENT_LIMIT));
    } catch {
      localStorage.removeItem(RECENT_KEY);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recentIds));
  }, [recentIds]);

  const commands = useMemo<CommandItem[]>(
    () => {
      const marketCommands: CommandItem[] = markets.map((market) => ({
        id: `market-${market.symbol}`,
        label: `Switch to ${market.symbol}`,
        icon: <BarChart3 className="h-4 w-4" />,
        shortcut: market.symbol === activeMarket ? "Active" : undefined,
        action: () => {
          setActiveMarket(market.symbol);
          navigate("/terminal");
          toast.success(`Focused ${market.symbol}`);
        },
        keywords: [market.symbol, market.name, "market", "switch"],
        category: "Markets",
      }));

      return [
        {
        id: "go-terminal",
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
      {
        id: "portfolio-analytics",
        label: "Open Portfolio Analytics",
        icon: <Scale className="h-4 w-4" />,
        shortcut: "A P",
        action: () => navigate("/portfolio#performance"),
        keywords: ["analytics", "risk", "correlation", "rebalance"],
        category: "Insights",
      },
      {
        id: "trade-journal",
        label: "Open Trade Journal",
        icon: <BookText className="h-4 w-4" />,
        shortcut: "A J",
        action: () => navigate("/portfolio#journal"),
        keywords: ["journal", "notes", "trade log"],
        category: "Insights",
      },
      {
        id: "focus-trade-form",
        label: `Focus ${activeMarket} Trade Form`,
        icon: <Zap className="h-4 w-4" />,
        shortcut: "B / S",
        action: () => {
          navigate("/terminal");
          window.setTimeout(() => {
            dispatchTerminalAction({ type: "focus-trade-form" });
          }, 50);
        },
        keywords: ["trade", "form", "focus", "size", "order"],
        category: "Actions",
      },
      {
        id: "buy-market-order",
        label: `Prepare Buy Market Order for ${activeMarket}`,
        icon: <Zap className="h-4 w-4" />,
        action: () => {
          navigate("/terminal");
          window.setTimeout(() => {
            dispatchTerminalAction({
              type: "prepare-order",
              side: "buy",
              orderType: "market",
              focusField: "size",
            });
          }, 50);
        },
        keywords: ["buy", "market", "order", activeMarket],
        category: "Actions",
      },
      {
        id: "sell-limit-order",
        label: `Prepare Sell Limit Order for ${activeMarket}`,
        icon: <Zap className="h-4 w-4" />,
        action: () => {
          navigate("/terminal");
          window.setTimeout(() => {
            dispatchTerminalAction({
              type: "prepare-order",
              side: "sell",
              orderType: "limit",
              focusField: "price",
            });
          }, 50);
        },
        keywords: ["sell", "limit", "order", activeMarket],
        category: "Actions",
      },
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
        action: () => {
          onOpenChange(false);
          toast.info("Click the bell icon in the top bar to view notifications");
        },
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
      ...marketCommands,
    ];
    },
    [
      activeMarket,
      disconnectWallet,
      isConnected,
      markets,
      navigate,
      onOpenChange,
      setActiveMarket,
      theme,
      toggleTheme,
    ]
  );

  const recentCommands = useMemo(
    () =>
      recentIds
        .map((id) => commands.find((command) => command.id === id))
        .filter((command): command is CommandItem => Boolean(command)),
    [commands, recentIds]
  );

  const filteredCommands = useMemo(() => {
    const terms = normalize(search)
      .split(/\s+/)
      .filter(Boolean);

    return commands
      .map((command) => ({
        command,
        score: scoreCommand(command, terms),
      }))
      .filter(({ score }) => (terms.length === 0 ? true : score > 0))
      .sort((left, right) => right.score - left.score || left.command.label.localeCompare(right.command.label))
      .map(({ command }) => command);
  }, [commands, search]);

  const groupedCommands = useMemo(() => {
    const grouped = filteredCommands.reduce((acc, command) => {
      if (!acc[command.category]) acc[command.category] = [];
      acc[command.category].push(command);
      return acc;
    }, {} as Record<string, CommandItem[]>);

    return Object.fromEntries(
      Object.entries(grouped).sort(([left], [right]) => left.localeCompare(right))
    );
  }, [filteredCommands]);

  const markRecent = useCallback((commandId: string) => {
    setRecentIds((current) => [commandId, ...current.filter((id) => id !== commandId)].slice(0, RECENT_LIMIT));
  }, []);

  const handleSelect = useCallback(
    async (command: CommandItem) => {
      markRecent(command.id);
      await command.action();
      onOpenChange(false);
      setSearch("");
    },
    [markRecent, onOpenChange]
  );

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onOpenChange(true);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-hidden border border-border/50 bg-card/95 p-0 backdrop-blur-xl">
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:rounded-md [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]]:font-mono [&_[cmdk-item]]:text-sm">
          <div className="flex items-center border-b border-border/50 px-3">
            <Search className="mr-2 h-5 w-5 text-muted-foreground" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Search commands, navigation, or actions..."
              className="h-12 flex-1 border-0 bg-transparent font-mono outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden rounded border border-border/50 bg-secondary/50 px-2 py-0.5 font-mono text-[10px] text-muted-foreground md:inline-flex md:items-center md:gap-1">
              <CommandIcon className="h-3 w-3" />
              <span>K</span>
            </kbd>
          </div>

          <Command.List className="max-h-[420px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center font-mono text-sm text-muted-foreground">
              No commands found for "{search}"
            </Command.Empty>

            {search.trim().length === 0 && recentCommands.length > 0 && (
              <Command.Group heading="Recent" className="px-2 py-2">
                {recentCommands.map((command) => (
                  <Command.Item
                    key={command.id}
                    value={command.id}
                    onSelect={() => handleSelect(command)}
                    className="group flex cursor-pointer items-center justify-between rounded-md px-2 py-2.5 transition-colors hover:bg-secondary data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground group-data-[selected=true]:text-primary">
                        {command.icon}
                      </span>
                      <span>{command.label}</span>
                    </div>
                    {command.shortcut && (
                      <div className="flex items-center gap-1">
                        {command.shortcut.split(" ").map((key) => (
                          <kbd
                            key={key}
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
            )}

            {Object.entries(groupedCommands).map(([category, items]) => (
              <Command.Group
                key={category}
                heading={category}
                className="px-2 py-2"
              >
                {items.map((command) => (
                  <Command.Item
                    key={command.id}
                    value={command.id}
                    onSelect={() => handleSelect(command)}
                    className="group flex cursor-pointer items-center justify-between rounded-md px-2 py-2.5 transition-colors hover:bg-secondary data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground group-data-[selected=true]:text-primary">
                        {command.icon}
                      </span>
                      <span>{command.label}</span>
                    </div>
                    {command.shortcut && (
                      <div className="flex items-center gap-1">
                        {command.shortcut.split(" ").map((key) => (
                          <kbd
                            key={key}
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

          <div className="flex items-center justify-between border-t border-border/50 px-3 py-2 text-xs text-muted-foreground">
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
              {filteredCommands.length} results
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
