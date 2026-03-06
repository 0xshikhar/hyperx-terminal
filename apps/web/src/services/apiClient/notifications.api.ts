import { apiClient } from "@/services/apiClient/client";

export type NotificationItem = {
  id: string;
  title: string;
  message: string | null;
  type: string;
  amount: string | null;
  status: "unread" | "read";
  createdAt: string;
};

export async function listNotifications() {
  const response = await apiClient.get<{ notifications: NotificationItem[] }>("/notifications");
  return response.data.notifications;
}

export async function markNotificationRead(id: string) {
  const response = await apiClient.post<{ updated: number }>(`/notifications/${id}/read`);
  return response.data.updated;
}

export async function createNotification(input: {
  title: string;
  message?: string;
  type: string;
  amount?: string;
}) {
  const response = await apiClient.post<{ notification: NotificationItem }>("/notifications", input);
  return response.data.notification;
}
