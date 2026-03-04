import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertManager } from "@/components/alerts/AlertManager";
import { useQuery } from "@tanstack/react-query";
import { listAlerts } from "@/services/apiClient/alerts.api";

export function AlertBell() {
  const { data: alerts = [] } = useQuery({
    queryKey: ["alerts"],
    queryFn: listAlerts,
    retry: false,
  });
  const count = alerts.filter((a) => !a.triggered).length;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="relative flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-foreground">
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span
              className={cn(
                "absolute -right-1 -top-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground"
              )}
            >
              {count}
            </span>
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Alerts</DialogTitle>
        </DialogHeader>
        <AlertManager />
      </DialogContent>
    </Dialog>
  );
}
