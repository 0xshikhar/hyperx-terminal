import { BellRing } from "lucide-react";
import { AlertManager } from "@/components/alerts/AlertManager";

export function PriceAlertsV2() {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <BellRing className="h-4 w-4" />
          Price Alerts v2
        </h3>
        <span className="text-xs text-muted-foreground">
          REST + live market triggers
        </span>
      </div>
      <AlertManager />
    </div>
  );
}
