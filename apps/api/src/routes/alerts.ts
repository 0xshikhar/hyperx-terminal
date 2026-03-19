import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AlertCondition } from "@prisma/client";
import { prisma } from "../db/client.js";
import { getAuthedUser } from "./helpers.js";
import { createNotification, formatNotifAmount } from "../services/notifications.service.js";

const alertCreateSchema = z.object({
  market: z.string().min(1),
  condition: z.nativeEnum(AlertCondition),
  targetPrice: z.string().min(1),
});

export async function alertRoutes(app: FastifyInstance) {
  app.get("/api/alerts", async (req, reply) => {
    const user = await getAuthedUser(req, reply);
    if (!user) return;

    const alerts = await prisma.priceAlert.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return {
      alerts: alerts.map((alert) => ({
        id: alert.id,
        market: alert.market,
        condition: alert.condition,
        targetPrice: alert.targetPrice.toString(),
        triggered: alert.triggered,
        triggeredAt: alert.triggeredAt ? alert.triggeredAt.toISOString() : null,
        createdAt: alert.createdAt.toISOString(),
      })),
    };
  });

  app.post("/api/alerts", async (req, reply) => {
    const user = await getAuthedUser(req, reply);
    if (!user) return;

    const body = alertCreateSchema.safeParse(req.body);
    if (!body.success) {
      reply.status(400);
      return { error: "invalid_alert" };
    }

    const created = await prisma.priceAlert.create({
      data: {
        userId: user.id,
        market: body.data.market,
        condition: body.data.condition,
        targetPrice: body.data.targetPrice,
      },
    });

    try {
      await createNotification({
        userId: user.id,
        title: "Alert Created",
        message: `${body.data.market} ${body.data.condition === "ABOVE" ? ">" : "<"} $${formatNotifAmount(body.data.targetPrice)}`,
        type: "alert",
        amount: body.data.targetPrice,
      });
    } catch {}

    return {
      alert: {
        id: created.id,
        market: created.market,
        condition: created.condition,
        targetPrice: created.targetPrice.toString(),
        triggered: created.triggered,
        createdAt: created.createdAt.toISOString(),
      },
    };
  });

  app.delete("/api/alerts/:id", async (req, reply) => {
    const user = await getAuthedUser(req, reply);
    if (!user) return;

    const idSchema = z.object({ id: z.string().min(1) });
    const params = idSchema.safeParse(req.params);
    if (!params.success) {
      reply.status(400);
      return { error: "invalid_alert_id" };
    }

    const deleted = await prisma.priceAlert.deleteMany({
      where: { id: params.data.id, userId: user.id },
    });

    return { deleted: deleted.count };
  });
}
