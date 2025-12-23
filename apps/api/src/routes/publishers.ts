import { FastifyInstance } from "fastify";
import { z } from "zod";
import { getPagination } from "../utils/pagination";

const publisherSchema = z.object({
  name: z.string().min(1),
  country: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

export default async function publisherRoutes(fastify: FastifyInstance) {
  fastify.get("/", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { q } = request.query as { q?: string };
    const { page, pageSize, skip, take } = getPagination(request.query as Record<string, any>);
    const userId = request.user!.id;

    const where = {
      userId,
      ...(q
        ? {
            name: {
              contains: q,
              mode: "insensitive" as const
            }
          }
        : {})
    };

    const [total, items] = await Promise.all([
      fastify.prisma.publisher.count({ where }),
      fastify.prisma.publisher.findMany({
        where,
        orderBy: { name: "asc" },
        skip,
        take,
        include: { _count: { select: { series: true } } }
      })
    ]);

    reply.send({ items, page, pageSize, total });
  });

  fastify.post("/", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const body = publisherSchema.parse(request.body);
    const userId = request.user!.id;

    const created = await fastify.prisma.publisher.create({
      data: {
        userId,
        name: body.name,
        country: body.country ?? null,
        notes: body.notes ?? null
      }
    });

    reply.status(201).send(created);
  });

  fastify.get("/:id", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.id;

    const publisher = await fastify.prisma.publisher.findFirst({
      where: { id, userId },
      include: {
        series: { orderBy: { name: "asc" } },
        events: { orderBy: { sequenceOrder: "asc" } }
      }
    });

    if (!publisher) {
      reply.status(404).send({ error: "Not found" });
      return;
    }

    reply.send(publisher);
  });

  fastify.put("/:id", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = publisherSchema.parse(request.body);
    const userId = request.user!.id;

    const updated = await fastify.prisma.publisher.updateMany({
      where: { id, userId },
      data: {
        name: body.name,
        country: body.country ?? null,
        notes: body.notes ?? null
      }
    });

    if (updated.count === 0) {
      reply.status(404).send({ error: "Not found" });
      return;
    }

    const result = await fastify.prisma.publisher.findUnique({ where: { id } });
    reply.send(result);
  });

  fastify.delete("/:id", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.id;

    const deleted = await fastify.prisma.publisher.deleteMany({
      where: { id, userId }
    });

    if (deleted.count === 0) {
      reply.status(404).send({ error: "Not found" });
      return;
    }

    reply.send({ ok: true });
  });
}
