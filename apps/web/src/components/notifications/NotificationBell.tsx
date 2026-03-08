import { BellRing } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { useQuery } from "@tanstack/react-query";
import { listNotifications } from "@/services/apiClient/notifications.api";
import { useWallet } from "@/components/wallet/useWallet";
import { cn } from "@/lib/utils";
import { isAuthenticated } from "@/services/auth.service";

export function NotificationBell() {
  const address = useWallet((state) => state.address);
  const authed = isAuthenticated();
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: listNotifications,
    retry: false,
    enabled: Boolean(address) && authed,
  });
  const count = notifications.filter((item) => item.status === "unread").length;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="relative flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-foreground">
          <BellRing className="h-4 w-4" />
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
          <DialogTitle>Notifications</DialogTitle>
        </DialogHeader>
        <NotificationCenter />
      </DialogContent>
    </Dialog>
  );
}
