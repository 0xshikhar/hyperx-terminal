import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  listNotifications,
  markNotificationRead,
  type NotificationItem,
} from "@/services/apiClient/notifications.api";
import { useWallet } from "@/components/wallet/useWallet";

export function NotificationCenter() {
  const queryClient = useQueryClient();
  const address = useWallet((state) => state.address);

  const { data: notifications = [], isError, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: listNotifications,
    retry: false,
    enabled: Boolean(address),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const unreadCount = useMemo(
    () => notifications.filter((item) => item.status === "unread").length,
    [notifications]
  );

  if (!address) {
    return (
      <div className="px-3 py-3 text-xs text-muted-foreground">
        Connect wallet to view notifications.
      </div>
    );
  }

  if (isLoading) {
    return <div className="px-3 py-3 text-xs text-muted-foreground">Loading…</div>;
  }

  if (isError) {
    return (
      <div className="px-3 py-3 text-xs text-muted-foreground">
        Connect wallet to view notifications.
      </div>
    );
  }

  if (notifications.length === 0) {
    return <div className="px-3 py-3 text-xs text-muted-foreground">No notifications yet.</div>;
  }

  return (
    <div className="divide-y divide-border">
      <div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground">
        <span>{notifications.length} total</span>
        <span>{unreadCount} unread</span>
      </div>
      {notifications.map((item: NotificationItem) => (
        <div key={item.id} className="flex items-center justify-between px-3 py-2 text-xs">
          <div className="space-y-0.5">
            <p className={cn("font-semibold", item.status === "unread" ? "text-foreground" : "text-muted-foreground")}>
              {item.title}
            </p>
            {item.message && (
              <p className="text-muted-foreground">{item.message}</p>
            )}
            <p className="text-[10px] text-muted-foreground">
              {new Date(item.createdAt).toLocaleTimeString()}
            </p>
          </div>
          {item.status === "unread" && (
            <button
              onClick={() => markRead.mutate(item.id)}
              className="rounded-md border border-border px-2 py-1 text-[10px] uppercase text-muted-foreground"
            >
              Mark Read
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
