import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { listNotifications } from "@/services/apiClient/notifications.api";
import { useWallet } from "@/components/wallet/useWallet";

export function NotificationsToastBridge() {
  const address = useWallet((state) => state.address);
  const seenRef = useRef<Set<string>>(new Set());

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", "toast-bridge"],
    queryFn: listNotifications,
    retry: false,
    enabled: Boolean(address),
    refetchInterval: 30000,
  });

  useEffect(() => {
    notifications.forEach((item) => {
      if (item.status !== "unread" || seenRef.current.has(item.id)) return;
      seenRef.current.add(item.id);
      toast(item.title, {
        description: item.message ?? undefined,
      });
    });
  }, [notifications]);

  return null;
}
