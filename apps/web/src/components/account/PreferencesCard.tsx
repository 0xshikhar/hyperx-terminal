import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useMarketStore } from "@/store/marketStore";
import { getMe } from "@/services/apiClient/me.api";
import { updatePreferences } from "@/services/apiClient/preferences.api";

export function PreferencesCard() {
  const markets = useMarketStore((s) => s.markets);
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        Loading preferences…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        Connect wallet to edit preferences.
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
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
      markets={markets.map((m) => m.symbol)}
      onSave={async (next) => {
        await updatePreferences(next);
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
  markets: string[];
  onSave: (input: {
    favoriteMarkets: string[];
    defaultMarket: string;
    defaultLeverage: number;
  }) => Promise<void>;
}) {
  const [favorites, setFavorites] = useState<string[]>(props.initialFavorites);
  const [defaultMarket, setDefaultMarket] = useState<string>(
    props.initialDefaultMarket
  );
  const [defaultLeverage, setDefaultLeverage] = useState<number>(
    props.initialDefaultLeverage
  );

  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);

  const mutation = useMutation({
    mutationFn: () =>
      props.onSave({
        favoriteMarkets: favorites,
        defaultMarket,
        defaultLeverage,
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
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Preferences</h3>
          <p className="text-xs text-muted-foreground">
            Saved per wallet: {props.walletAddress}
          </p>
        </div>
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {mutation.isPending ? "Saving..." : "Save"}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] uppercase text-muted-foreground">
            Default Market
          </p>
          <select
            value={defaultMarket}
            onChange={(event) => setDefaultMarket(event.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            {props.markets.map((symbol) => (
              <option key={symbol} value={symbol}>
                {symbol}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="text-[10px] uppercase text-muted-foreground">
            Default Leverage
          </p>
          <input
            value={defaultLeverage}
            onChange={(event) => setDefaultLeverage(Number(event.target.value))}
            type="number"
            min={1}
            max={100}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[10px] uppercase text-muted-foreground">Favorites</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {props.markets.map((symbol) => {
            const isFavorite = favoriteSet.has(symbol);
            return (
              <button
                key={symbol}
                onClick={() => toggleFavorite(symbol)}
                className={
                  isFavorite
                    ? "rounded-md border border-primary bg-primary/10 px-2 py-1 text-xs text-primary"
                    : "rounded-md border border-border px-2 py-1 text-xs text-muted-foreground"
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
