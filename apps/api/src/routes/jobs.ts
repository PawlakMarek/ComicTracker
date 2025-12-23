import { FastifyInstance } from "fastify";
import { JobStatus } from "@prisma/client";

export default async function jobsRoutes(fastify: FastifyInstance) {
  fastify.get("/", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const userId = request.user!.id;
    const { status, take } = request.query as { status?: string; take?: string };
    const parsedStatus = status && (Object.values(JobStatus) as string[]).includes(status) ? (status as JobStatus) : undefined;

    const items = await fastify.prisma.job.findMany({
      where: {
        userId,
        ...(parsedStatus ? { status: parsedStatus } : {})
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(50, Number(take) || 20)
    });

    reply.send({ items });
  });
}
