import { FastifyInstance } from "fastify";
import { z } from "zod";
import { getPagination } from "../utils/pagination";

const eventSchema = z.object({
  name: z.string().min(1),
  publisherId: z.string().min(1),
  startYear: z.number().int().min(1900).max(2100),
  endYear: z.number().int().min(1900).max(2100).nullable().optional(),
  sequenceOrder: z.number().int().min(0),
  notes: z.string().nullable().optional()
});

export default async function eventRoutes(fastify: FastifyInstance) {
  fastify.get("/", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { q, publisherId, sort, order } = request.query as {
      q?: string;
      publisherId?: string;
      sort?: string;
      order?: string;
    };
    const { page, pageSize, skip, take } = getPagination(request.query as Record<string, any>);
    const userId = request.user!.id;

    const where: Record<string, any> = {
      userId,
      ...(publisherId ? { publisherId } : {}),
      ...(q
        ? {
            name: {
              contains: q,
              mode: "insensitive" as const
            }
          }
        : {})
    };

    const sortFields = ["sequenceOrder", "name", "startYear", "endYear", "createdAt"] as const;
    const sortField = sortFields.includes(sort as (typeof sortFields)[number])
      ? (sort as (typeof sortFields)[number])
      : "sequenceOrder";
    const sortOrder: "asc" | "desc" = order === "desc" ? "desc" : "asc";

    const [total, items] = await Promise.all([
      fastify.prisma.event.count({ where }),
      fastify.prisma.event.findMany({
        where,
        orderBy: { [sortField]: sortOrder },
        skip,
        take,
        include: { publisher: true }
      })
    ]);

    reply.send({ items, page, pageSize, total });
  });

  fastify.post("/", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const body = eventSchema.parse(request.body);
    const userId = request.user!.id;

    const created = await fastify.prisma.event.create({
      data: {
        userId,
        name: body.name,
        publisherId: body.publisherId,
        startYear: body.startYear,
        endYear: body.endYear ?? null,
        sequenceOrder: body.sequenceOrder,
        notes: body.notes ?? null
      }
    });

    reply.status(201).send(created);
  });

  fastify.get("/:id", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.id;

    const event = await fastify.prisma.event.findFirst({
      where: { id, userId },
      include: {
        publisher: true,
        storyBlocks: { orderBy: { orderIndex: "asc" } },
        issueEvents: { include: { issue: true } }
      }
    });

    if (!event) {
      reply.status(404).send({ error: "Not found" });
      return;
    }

    reply.send(event);
  });

  fastify.put("/:id", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = eventSchema.parse(request.body);
    const userId = request.user!.id;

    const updated = await fastify.prisma.event.updateMany({
      where: { id, userId },
      data: {
        name: body.name,
        publisherId: body.publisherId,
        startYear: body.startYear,
        endYear: body.endYear ?? null,
        sequenceOrder: body.sequenceOrder,
        notes: body.notes ?? null
      }
    });

    if (updated.count === 0) {
      reply.status(404).send({ error: "Not found" });
      return;
    }

    const result = await fastify.prisma.event.findUnique({ where: { id } });
    reply.send(result);
  });

  fastify.delete("/:id", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.id;

    const deleted = await fastify.prisma.$transaction(async (prisma) => {
      await prisma.storyBlock.updateMany({
        where: { userId, eventId: id },
        data: { eventId: null }
      });
      await prisma.issueEvent.deleteMany({ where: { eventId: id } });

      return prisma.event.deleteMany({
        where: { id, userId }
      });
    });

    if (deleted.count === 0) {
      reply.status(404).send({ error: "Not found" });
      return;
    }

    reply.send({ ok: true });
  });
}
