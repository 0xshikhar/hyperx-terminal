import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/client.js";
import { getAuthedUser } from "./helpers.js";

const notificationCreateSchema = z.object({
  title: z.string().min(1),
  message: z.string().optional(),
  type: z.string().min(1),
  amount: z.string().optional(),
});

export async function notificationRoutes(app: FastifyInstance) {
  app.get("/api/notifications", async (req, reply) => {
    const user = await getAuthedUser(req, reply);
    if (!user) return;

    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return {
      notifications: notifications.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        amount: n.amount,
        status: n.status,
        createdAt: n.createdAt.toISOString(),
      })),
    };
  });

  app.post("/api/notifications", async (req, reply) => {
    const user = await getAuthedUser(req, reply);
    if (!user) return;

    const body = notificationCreateSchema.safeParse(req.body);
    if (!body.success) {
      reply.status(400);
      return { error: "invalid_notification" };
    }

    const created = await prisma.notification.create({
      data: {
        userId: user.id,
        title: body.data.title,
        message: body.data.message,
        type: body.data.type,
        amount: body.data.amount,
      },
    });

    return {
      notification: {
        id: created.id,
        title: created.title,
        message: created.message,
        type: created.type,
        amount: created.amount,
        status: created.status,
        createdAt: created.createdAt.toISOString(),
      },
    };
  });

  app.post("/api/notifications/:id/read", async (req, reply) => {
    const user = await getAuthedUser(req, reply);
    if (!user) return;

    const idSchema = z.object({ id: z.string().min(1) });
    const params = idSchema.safeParse(req.params);
    if (!params.success) {
      reply.status(400);
      return { error: "invalid_notification_id" };
    }

    const updated = await prisma.notification.updateMany({
      where: { id: params.data.id, userId: user.id },
      data: { status: "read" },
    });

    return { updated: updated.count };
  });
}
