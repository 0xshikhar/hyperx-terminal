import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { calculateVolumeProfile } from "@/components/chart/TechnicalIndicators";

interface VolumeProfileProps {
  prices: number[];
  volumes: number[];
}

export function VolumeProfile({ prices, volumes }: VolumeProfileProps) {
  const profile = useMemo(() => {
    if (prices.length === 0 || volumes.length === 0) return [];
    return calculateVolumeProfile(prices, volumes, 16).slice(-12);
  }, [prices, volumes]);

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-3 flex items-center gap-2">
        <BarChart3 className="h-4 w-4" />
        <h3 className="text-sm font-semibold">Volume Profile</h3>
      </div>

      <div className="space-y-2">
        {profile.length === 0 ? (
          <div className="text-xs text-muted-foreground">Waiting for trade distribution...</div>
        ) : (
          profile.map((bucket) => (
            <div key={bucket.price} className="grid grid-cols-[64px,1fr,48px] items-center gap-2 text-xs">
              <span className="font-mono text-muted-foreground">{bucket.price.toFixed(0)}</span>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${bucket.percent}%` }}
                />
              </div>
              <span className="font-mono">{bucket.percent.toFixed(0)}%</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
