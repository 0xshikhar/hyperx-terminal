import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createAlert,
  deleteAlert,
  listAlerts,
  type AlertCondition,
} from "@/services/apiClient/alerts.api";
import { AlertForm } from "@/components/alerts/AlertForm";
import { useWallet } from "@/components/wallet/useWallet";
import { isAuthenticated } from "@/services/auth.service";

export function AlertManager() {
  const queryClient = useQueryClient();
  const address = useWallet((state) => state.address);
  const authed = isAuthenticated();
  const alertsEnabled = Boolean(address) && authed;
  const { data: alerts = [], isLoading, isError } = useQuery({
    queryKey: ["alerts"],
    queryFn: listAlerts,
    retry: false,
    enabled: alertsEnabled,
  });

  const createMutation = useMutation({
    mutationFn: (input: {
      market: string;
      condition: AlertCondition;
      targetPrice: string;
    }) => createAlert(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["alerts"] });
      toast.success("Alert created");
    },
    onError: () => {
      toast.error("Failed to create alert");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAlert(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["alerts"] });
      toast.success("Alert deleted");
    },
    onError: () => {
      toast.error("Failed to delete alert");
    },
  });

  return (
    <div className="space-y-4">
      <AlertForm
        onSubmit={async (input) => {
          if (!alertsEnabled) {
            toast.error("Connect wallet to manage alerts");
            return;
          }
          await createMutation.mutateAsync(input);
        }}
      />

      <div className="rounded-md border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div>
            <p className="text-sm font-semibold">Price Alerts</p>
            <p className="text-xs text-muted-foreground">
              {alerts.length} total
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="px-3 py-3 text-xs text-muted-foreground">Loading…</div>
        ) : !alertsEnabled ? (
          <div className="px-3 py-3 text-xs text-muted-foreground">
            Connect wallet to load alerts.
          </div>
        ) : isError ? (
          <div className="px-3 py-3 text-xs text-muted-foreground">
            Alerts are temporarily unavailable.
          </div>
        ) : alerts.length === 0 ? (
          <div className="px-3 py-3 text-xs text-muted-foreground">
            No alerts yet.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between px-3 py-2 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{alert.market}</span>
                    <span className="text-muted-foreground">
                      {alert.condition}
                    </span>
                  </div>
                  <div className="text-muted-foreground">
                    Target: {alert.targetPrice}
                  </div>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(alert.id)}
                  className="rounded-md border border-border p-2 text-muted-foreground hover:text-foreground"
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
