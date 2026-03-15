import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useMarketStore } from "@/store/marketStore";
import { getMe } from "@/services/apiClient/me.api";
import { updatePreferences } from "@/services/apiClient/preferences.api";
import { useUIStore } from "@/store/uiStore";

export function PreferencesCard() {
  const markets = useMarketStore((s) => s.markets);
  const setTheme = useUIStore((s) => s.setTheme);
  const setDefaultMarket = useUIStore((s) => s.setDefaultMarket);
  const setFavoriteMarkets = useUIStore((s) => s.setFavoriteMarkets);
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    retry: false,
  });

  useEffect(() => {
    if (!data) return;
    const prefs = data.user.preferences;
    if (prefs?.theme) {
      setTheme(prefs.theme === "light" ? "light" : "dark");
    }
    if (prefs?.defaultMarket) {
      setDefaultMarket(prefs.defaultMarket);
    }
    if (prefs?.favoriteMarkets) {
      setFavoriteMarkets(prefs.favoriteMarkets);
    }
  }, [data, setDefaultMarket, setFavoriteMarkets, setTheme]);

  if (isLoading) {
    return (
      <div className="rounded-[18px] border border-[#213136] bg-[#091416] p-4 text-sm text-[#7e8c91]">
        Loading preferences…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-[18px] border border-[#213136] bg-[#091416] p-4 text-sm text-[#7e8c91]">
        Connect wallet to edit preferences.
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-[18px] border border-[#213136] bg-[#091416] p-4 text-sm text-[#7e8c91]">
        Preferences unavailable.
      </div>
    );
  }

  return (
    <PreferencesCardContent
      key={data.user.id}
      walletAddress={data.user.walletAddress}
      initialFavorites={data.user.preferences?.favoriteMarkets ?? []}
      initialDefaultMarket={
        data.user.preferences?.defaultMarket ?? markets[0]?.symbol ?? "BTC-USD"
      }
      initialDefaultLeverage={data.user.preferences?.defaultLeverage ?? 10}
      initialTheme={data.user.preferences?.theme === "light" ? "light" : "dark"}
      markets={markets.map((m) => m.symbol)}
      onSave={async (next) => {
        await updatePreferences(next);
        setTheme(next.theme);
        setDefaultMarket(next.defaultMarket);
        setFavoriteMarkets(next.favoriteMarkets);
        await queryClient.invalidateQueries({ queryKey: ["me"] });
      }}
    />
  );
}

function PreferencesCardContent(props: {
  walletAddress: string;
  initialFavorites: string[];
  initialDefaultMarket: string;
  initialDefaultLeverage: number;
  initialTheme: "dark" | "light";
  markets: string[];
  onSave: (input: {
    favoriteMarkets: string[];
    defaultMarket: string;
    defaultLeverage: number;
    theme: "dark" | "light";
  }) => Promise<void>;
}) {
  const [favorites, setFavorites] = useState<string[]>(props.initialFavorites);
  const [defaultMarket, setDefaultMarket] = useState<string>(
    props.initialDefaultMarket
  );
  const [defaultLeverage, setDefaultLeverage] = useState<number>(
    props.initialDefaultLeverage
  );
  const [theme, setTheme] = useState<"dark" | "light">(props.initialTheme);

  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);

  const mutation = useMutation({
    mutationFn: () =>
      props.onSave({
        favoriteMarkets: favorites,
        defaultMarket,
        defaultLeverage,
        theme,
      }),
    onSuccess: () => {
      toast.success("Preferences saved");
    },
    onError: () => {
      toast.error("Failed to save preferences");
    },
  });

  const toggleFavorite = (symbol: string) => {
    setFavorites((prev) => {
      if (prev.includes(symbol)) return prev.filter((s) => s !== symbol);
      return [...prev, symbol];
    });
  };

  return (
    <div className="rounded-[18px] border border-[#213136] bg-[#091416]">
      <div className="flex items-center justify-between border-b border-[#152327] px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-[#dde5e7]">Preferences</h3>
          <p className="text-xs text-[#7e8c91]">
            Saved per wallet: {props.walletAddress}
          </p>
        </div>
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="rounded-md border border-[#2a555c] bg-[#102125] px-3 py-2 text-xs font-semibold text-[#53d8c8] transition-colors hover:border-[#53d8c8] disabled:opacity-50"
        >
          {mutation.isPending ? "Saving..." : "Save"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 p-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] text-[#708084]">
            Default Market
          </p>
          <select
            value={defaultMarket}
            onChange={(event) => setDefaultMarket(event.target.value)}
            className="mt-1 w-full rounded-md border border-[#213136] bg-[#102125] px-3 py-2 text-sm text-[#d8dfe1] outline-none focus:border-[#53d8c8]"
          >
            {props.markets.map((symbol) => (
              <option key={symbol} value={symbol}>
                {symbol}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] text-[#708084]">
            Default Leverage
          </p>
          <input
            value={defaultLeverage}
            onChange={(event) => setDefaultLeverage(Number(event.target.value))}
            type="number"
            min={1}
            max={100}
            className="mt-1 w-full rounded-md border border-[#213136] bg-[#102125] px-3 py-2 text-sm text-[#d8dfe1] outline-none focus:border-[#53d8c8]"
          />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] text-[#708084]">Theme</p>
          <select
            value={theme}
            onChange={(event) => setTheme(event.target.value as "dark" | "light")}
            className="mt-1 w-full rounded-md border border-[#213136] bg-[#102125] px-3 py-2 text-sm text-[#d8dfe1] outline-none focus:border-[#53d8c8]"
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </div>
      </div>

      <div className="border-t border-[#152327] px-4 py-4">
        <p className="text-[10px] uppercase tracking-[0.12em] text-[#708084]">Favorites</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {props.markets.map((symbol) => {
            const isFavorite = favoriteSet.has(symbol);
            return (
              <button
                key={symbol}
                onClick={() => toggleFavorite(symbol)}
                className={
                  isFavorite
                    ? "rounded-md border border-[#53d8c8] bg-[#102125] px-2 py-1 text-xs text-[#53d8c8]"
                    : "rounded-md border border-[#1d2b2f] px-2 py-1 text-xs text-[#7e8c91]"
                }
              >
                {symbol}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
