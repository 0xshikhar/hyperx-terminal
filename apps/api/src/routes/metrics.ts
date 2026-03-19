import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { MetricPayload } from "@hyperx/types/api";

const metricsBuffer: MetricPayload[] = [];
const MAX_METRICS = 200;

const metricsSchema = z.object({
  metrics: z.array(
    z.object({
      name: z.string(),
      value: z.number(),
      timestamp: z.number(),
      meta: z.record(z.unknown()).optional(),
    })
  ),
});

export async function metricRoutes(app: FastifyInstance) {
  app.post("/api/metrics", async (req, reply) => {
    const parsed = metricsSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.status(400);
      return { error: "invalid_metrics" };
    }

    metricsBuffer.push(...parsed.data.metrics);
    if (metricsBuffer.length > MAX_METRICS) {
      metricsBuffer.splice(0, metricsBuffer.length - MAX_METRICS);
    }
    return { accepted: parsed.data.metrics.length };
  });

  app.get("/api/metrics", async () => ({
    metrics: metricsBuffer.slice(-50),
  }));
}
