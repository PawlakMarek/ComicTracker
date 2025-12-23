import { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getPagination } from "../utils/pagination";
import { SeriesTypeValues } from "../utils/enums";

const seriesSchema = z.object({
  name: z.string().min(1),
  publisherId: z.string().min(1),
  startYear: z.number().int().min(1900).max(2100),
  endYear: z.number().int().min(1900).max(2100).nullable().optional(),
  era: z.string().nullable().optional(),
  chronology: z.string().nullable().optional(),
  type: z.enum(SeriesTypeValues),
  notes: z.string().nullable().optional()
});

export default async function seriesRoutes(fastify: FastifyInstance) {
  fastify.get("/", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { q, publisherId, era, type, sort, order } = request.query as {
      q?: string;
      publisherId?: string;
      era?: string;
      type?: string;
      sort?: string;
      order?: string;
    };

    const { page, pageSize, skip, take } = getPagination(request.query as Record<string, any>);
    const userId = request.user!.id;

    const where: Record<string, any> = {
      userId,
      ...(publisherId ? { publisherId } : {}),
      ...(era ? { era } : {}),
      ...(type ? { type } : {}),
      ...(q
        ? {
            name: {
              contains: q,
              mode: "insensitive" as const
            }
          }
        : {})
    };

    const sortFields = ["name", "startYear", "endYear", "era", "chronology", "type", "createdAt"] as const;
    const sortField = sortFields.includes(sort as (typeof sortFields)[number])
      ? (sort as (typeof sortFields)[number])
      : "name";
    const sortOrder: Prisma.SortOrder = order === "desc" ? "desc" : "asc";
    const orderBy: Prisma.SeriesOrderByWithRelationInput = { [sortField]: sortOrder };

    const [total, items] = await Promise.all([
      fastify.prisma.series.count({ where }),
      fastify.prisma.series.findMany({
        where,
        orderBy,
        skip,
        take,
        include: { publisher: true }
      })
    ]);

    reply.send({ items, page, pageSize, total });
  });

  fastify.post("/bulk", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const userId = request.user!.id;
    const body = request.body as {
      items?: Array<{
        name?: string;
        publisherId?: string;
        publisherName?: string;
        startYear?: number | string;
        endYear?: number | string | null;
        era?: string | null;
        chronology?: string | null;
        type?: string;
        notes?: string | null;
      }>;
    };

    const items = body.items || [];
    if (!items.length) {
      reply.status(400).send({ error: "No items provided" });
      return;
    }

    const publisherNames = Array.from(
      new Set(items.map((item) => item.publisherName).filter((name): name is string => Boolean(name)))
    );

    if (publisherNames.length) {
      const existing = await fastify.prisma.publisher.findMany({
        where: { userId, name: { in: publisherNames } }
      });
      const existingNames = new Set(existing.map((publisher) => publisher.name));
      const missing = publisherNames.filter((name) => !existingNames.has(name));
      if (missing.length) {
        await fastify.prisma.publisher.createMany({
          data: missing.map((name) => ({ userId, name })),
          skipDuplicates: true
        });
      }
    }

    const publishers = publisherNames.length
      ? await fastify.prisma.publisher.findMany({
          where: { userId, name: { in: publisherNames } }
        })
      : [];
    const publisherMap = new Map(publishers.map((publisher) => [publisher.name, publisher.id]));

    const errors: string[] = [];

    const data: Prisma.SeriesCreateManyInput[] = [];
    items.forEach((item, index) => {
      const name = item.name?.trim();
      if (!name) {
        errors.push(`Row ${index + 1}: name is required`);
        return;
      }

      const publisherId = item.publisherId || (item.publisherName ? publisherMap.get(item.publisherName) : undefined);
      if (!publisherId) {
        errors.push(`Row ${index + 1}: publisherId or valid publisherName is required`);
        return;
      }

      const startYear = Number(item.startYear);
      if (Number.isNaN(startYear)) {
        errors.push(`Row ${index + 1}: startYear must be a number`);
        return;
      }

      const endYear =
        item.endYear === null || item.endYear === undefined || item.endYear === ""
          ? null
          : Number(item.endYear);
      if (endYear !== null && Number.isNaN(endYear)) {
        errors.push(`Row ${index + 1}: endYear must be a number`);
        return;
      }

      const type = SeriesTypeValues.includes(item.type as any) ? (item.type as any) : "ONGOING";

      data.push({
        userId,
        name,
        publisherId,
        startYear,
        endYear,
        era: item.era ?? null,
        chronology: item.chronology ?? null,
        type,
        notes: item.notes ?? null
      });
    });

    if (errors.length) {
      reply.status(400).send({ error: "Validation failed", details: errors });
      return;
    }

    const result = await fastify.prisma.series.createMany({
      data,
      skipDuplicates: true
    });

    reply.send({ imported: result.count, total: items.length });
  });

  fastify.post("/", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const body = seriesSchema.parse(request.body);
    const userId = request.user!.id;

    const created = await fastify.prisma.series.create({
      data: {
        userId,
        name: body.name,
        publisherId: body.publisherId,
        startYear: body.startYear,
        endYear: body.endYear ?? null,
        era: body.era ?? null,
        chronology: body.chronology ?? null,
        type: body.type,
        notes: body.notes ?? null
      }
    });

    reply.status(201).send(created);
  });

  fastify.get("/:id", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.id;

    const series = await fastify.prisma.series.findFirst({
      where: { id, userId },
      include: {
        publisher: true,
        issues: { orderBy: [{ readingOrderIndex: "asc" }, { issueNumberSort: "asc" }, { issueNumber: "asc" }] },
        storyBlockSeries: { include: { storyBlock: true } }
      }
    });

    if (!series) {
      reply.status(404).send({ error: "Not found" });
      return;
    }

    reply.send(series);
  });

  fastify.get("/:id/dependencies", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.id;

    const series = await fastify.prisma.series.findFirst({ where: { id, userId } });
    if (!series) {
      reply.status(404).send({ error: "Not found" });
      return;
    }

    const issueCount = await fastify.prisma.issue.count({ where: { userId, seriesId: id } });
    const storyBlocks = await fastify.prisma.storyBlock.findMany({
      where: { userId, storyBlockSeries: { some: { seriesId: id } } },
      include: { storyBlockSeries: true }
    });

    const multiSeriesStoryBlocks = storyBlocks
      .filter((block) => block.storyBlockSeries.length > 1)
      .map((block) => ({ id: block.id, name: block.name, seriesCount: block.storyBlockSeries.length }));

    reply.send({
      issueCount,
      storyBlockCount: storyBlocks.length,
      multiSeriesStoryBlocks
    });
  });

  fastify.put("/:id", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = seriesSchema.parse(request.body);
    const userId = request.user!.id;

    const updated = await fastify.prisma.series.updateMany({
      where: { id, userId },
      data: {
        name: body.name,
        publisherId: body.publisherId,
        startYear: body.startYear,
        endYear: body.endYear ?? null,
        era: body.era ?? null,
        chronology: body.chronology ?? null,
        type: body.type,
        notes: body.notes ?? null
      }
    });

    if (updated.count === 0) {
      reply.status(404).send({ error: "Not found" });
      return;
    }

    const result = await fastify.prisma.series.findUnique({ where: { id } });
    reply.send(result);
  });

  fastify.delete("/:id", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.id;

    const result = await fastify.prisma.$transaction(async (prisma) => {
      const storyBlocks = await prisma.storyBlock.findMany({
        where: { userId, storyBlockSeries: { some: { seriesId: id } } }
      });
      const storyBlockIds = storyBlocks.map((block) => block.id);
      const issueCount = await prisma.issue.count({ where: { userId, seriesId: id } });

      if (storyBlockIds.length) {
        await prisma.storyBlock.deleteMany({ where: { userId, id: { in: storyBlockIds } } });
      }

      const deleted = await prisma.series.deleteMany({
        where: { id, userId }
      });

      return {
        deletedCount: deleted.count,
        deletedStoryBlocks: storyBlockIds.length,
        deletedIssues: issueCount
      };
    });

    if (result.deletedCount === 0) {
      reply.status(404).send({ error: "Not found" });
      return;
    }

    reply.send({ ok: true, ...result });
  });
}
