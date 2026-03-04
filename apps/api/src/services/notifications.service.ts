import { prisma } from "../db/client.js";

export type CreateNotificationInput = {
  userId: string;
  title: string;
  message?: string;
  type: string;
  amount?: string;
};

export async function createNotification(input: CreateNotificationInput) {
  const created = await prisma.notification.create({
    data: {
      userId: input.userId,
      title: input.title,
      message: input.message ?? null,
      type: input.type,
      amount: input.amount ?? null,
    },
  });
  return created;
}

export function formatNotifAmount(value: string | number): string {
  const num = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(num)) return String(value);
  if (Math.abs(num) >= 1000) return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return num.toFixed(4);
}
