import { FastifyInstance } from "fastify";
import { z } from "zod";
import { getPagination } from "../utils/pagination";
import { computeStoryBlockMetrics } from "../services/storyBlockMetrics";
import { deriveReadingOrderStatus } from "../services/storyBlockDerived";

const orderSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  items: z
    .array(
      z.object({
        storyBlockId: z.string().min(1),
        orderIndex: z.number()
      })
    )
    .optional()
});

export default async function readingOrderRoutes(fastify: FastifyInstance) {
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
      fastify.prisma.readingOrder.count({ where }),
      fastify.prisma.readingOrder.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take,
        include: {
          _count: { select: { items: true } },
          items: { include: { storyBlock: { select: { status: true } } } }
        }
      })
    ]);

    reply.send({
      items: items.map((item) => ({
        ...item,
        status: deriveReadingOrderStatus(item.items.map((entry) => entry.storyBlock.status))
      })),
      page,
      pageSize,
      total
    });
  });

  fastify.post("/", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const userId = request.user!.id;
    const body = orderSchema.parse(request.body);

    const result = await fastify.prisma.$transaction(async (prisma) => {
      const created = await prisma.readingOrder.create({
        data: {
          userId,
          name: body.name,
          description: body.description ?? null
        }
      });

      if (body.items?.length) {
        const ids = body.items.map((item) => item.storyBlockId);
        const blocks = await prisma.storyBlock.findMany({ where: { userId, id: { in: ids } } });
        if (blocks.length !== ids.length) {
          throw new Error("One or more story blocks not found");
        }

        await prisma.readingOrderItem.createMany({
          data: body.items.map((item) => ({
            readingOrderId: created.id,
            storyBlockId: item.storyBlockId,
            orderIndex: item.orderIndex
          })),
          skipDuplicates: true
        });
      }

      return created;
    });

    reply.status(201).send(result);
  });

  fastify.get("/:id", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.id;

    const order = await fastify.prisma.readingOrder.findFirst({
      where: { id, userId },
      include: {
        items: {
          orderBy: { orderIndex: "asc" },
          include: {
            storyBlock: {
              include: {
                storyBlockIssues: { include: { issue: true } }
              }
            }
          }
        }
      }
    });

    if (!order) {
      reply.status(404).send({ error: "Not found" });
      return;
    }

    const withMetrics = order.items.map((item) => ({
      ...item,
      storyBlock: {
        ...item.storyBlock,
        metrics: computeStoryBlockMetrics(item.storyBlock)
      }
    }));

    reply.send({
      ...order,
      status: deriveReadingOrderStatus(order.items.map((item) => item.storyBlock.status)),
      items: withMetrics
    });
  });

  fastify.put("/:id", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.id;
    const body = orderSchema.parse(request.body);

    const result = await fastify.prisma.$transaction(async (prisma) => {
      const updated = await prisma.readingOrder.updateMany({
        where: { id, userId },
        data: {
          name: body.name,
          description: body.description ?? null
        }
      });

      if (updated.count === 0) {
        return null;
      }

      if (body.items) {
        const ids = body.items.map((item) => item.storyBlockId);
        if (ids.length) {
          const blocks = await prisma.storyBlock.findMany({ where: { userId, id: { in: ids } } });
          if (blocks.length !== ids.length) {
            throw new Error("One or more story blocks not found");
          }
        }

        await prisma.readingOrderItem.deleteMany({ where: { readingOrderId: id } });
        if (body.items.length) {
          await prisma.readingOrderItem.createMany({
            data: body.items.map((item) => ({
              readingOrderId: id,
              storyBlockId: item.storyBlockId,
              orderIndex: item.orderIndex
            })),
            skipDuplicates: true
          });
        }
      }

      return prisma.readingOrder.findUnique({
        where: { id },
        include: {
          items: {
            orderBy: { orderIndex: "asc" },
            include: { storyBlock: { include: { storyBlockIssues: { include: { issue: true } } } } }
          }
        }
      });
    });

    if (!result) {
      reply.status(404).send({ error: "Not found" });
      return;
    }

    reply.send(result);
  });

  fastify.delete("/:id", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.id;

    const deleted = await fastify.prisma.readingOrder.deleteMany({
      where: { id, userId }
    });

    if (deleted.count === 0) {
      reply.status(404).send({ error: "Not found" });
      return;
    }

    reply.send({ ok: true });
  });
}
