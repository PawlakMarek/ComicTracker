import { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getPagination } from "../utils/pagination";
import {
  StoryBlockImportanceValues,
  StoryBlockStatusValues,
  StoryBlockTypeValues,
  SyncLevelValues
} from "../utils/enums";
import { computeStoryBlockMetrics } from "../services/storyBlockMetrics";
import { deriveStoryBlockFromIssueIds, syncStoryBlockDerived } from "../services/storyBlockDerived";
import { compareIssues } from "../utils/issueSorting";

const storyBlockSchema = z.object({
  name: z.string().min(1),
  type: z.enum(StoryBlockTypeValues),
  era: z.string().nullable().optional(),
  chronology: z.string().nullable().optional(),
  startYear: z.number().int().min(1900).max(2100).optional(),
  endYear: z.number().int().min(1900).max(2100).nullable().optional(),
  importance: z.enum(StoryBlockImportanceValues),
  syncLevel: z.enum(SyncLevelValues),
  publisherId: z.string().nullable().optional(),
  previousStoryBlockId: z.string().nullable().optional(),
  eventId: z.string().nullable().optional(),
  orderIndex: z.number().min(0),
  status: z.enum(StoryBlockStatusValues).optional(),
  notes: z.string().nullable().optional(),
  seriesIds: z.array(z.string()).optional(),
  issueIds: z.array(z.string()).optional(),
  characterIds: z.array(z.string()).optional(),
  teamIds: z.array(z.string()).optional()
});

const validateRelations = async (
  prisma: FastifyInstance["prisma"],
  userId: string,
  body: z.infer<typeof storyBlockSchema>,
  storyBlockId?: string
): Promise<{ publisherId: string } | { error: string }> => {
  const seriesIds = body.seriesIds ?? [];
  const issueIds = body.issueIds ?? [];
  let publisherId = body.publisherId ?? null;

  if (publisherId) {
    const publisher = await prisma.publisher.findFirst({ where: { id: publisherId, userId } });
    if (!publisher) {
      return { error: "Publisher not found" };
    }
  }

  if (seriesIds.length) {
    const series = await prisma.series.findMany({
      where: { userId, id: { in: seriesIds } },
      select: { id: true, publisherId: true }
    });
    if (series.length !== seriesIds.length) {
      return { error: "One or more series not found" };
    }
    const publisherIds = Array.from(new Set(series.map((entry) => entry.publisherId)));
    if (publisherIds.length > 1) {
      return { error: "Series must belong to the same publisher" };
    }
    const inferredPublisherId = publisherIds[0];
    if (publisherId && publisherId !== inferredPublisherId) {
      return { error: "Series must belong to the selected publisher" };
    }
    publisherId = publisherId ?? inferredPublisherId;
  }

  if (body.eventId) {
    const event = await prisma.event.findFirst({ where: { id: body.eventId, userId } });
    if (!event) {
      return { error: "Event not found" };
    }
    if (publisherId && event.publisherId !== publisherId) {
      return { error: "Event must belong to the selected publisher" };
    }
    publisherId = publisherId ?? event.publisherId;
  }

  if (body.previousStoryBlockId) {
    if (storyBlockId && body.previousStoryBlockId === storyBlockId) {
      return { error: "Previous story block cannot reference itself" };
    }
    const previous = await prisma.storyBlock.findFirst({
      where: { id: body.previousStoryBlockId, userId }
    });
    if (!previous) {
      return { error: "Previous story block not found" };
    }
  }

  if (issueIds.length) {
    if (!seriesIds.length) {
      return { error: "Select series before assigning issues" };
    }
    const issues = await prisma.issue.findMany({
      where: { userId, id: { in: issueIds } },
      select: { id: true, seriesId: true }
    });
    if (issues.length !== issueIds.length) {
      return { error: "One or more issues not found" };
    }
    const invalid = issues.filter((issue) => !seriesIds.includes(issue.seriesId));
    if (invalid.length) {
      return { error: "Issues must belong to the selected series" };
    }
  }

  if (!publisherId) {
    return { error: "Publisher is required for story blocks" };
  }

  return { publisherId: publisherId as string };
};

export default async function storyBlockRoutes(fastify: FastifyInstance) {
  fastify.post("/derive", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const userId = request.user!.id;
    const body = request.body as { issueIds?: string[] };
    const issueIds = body.issueIds ?? [];

    if (!issueIds.length) {
      reply.send({ startYear: null, endYear: null, status: "NOT_STARTED", characters: [], teams: [] });
      return;
    }

    const derived = await deriveStoryBlockFromIssueIds(fastify.prisma, userId, issueIds);

    const [characters, teams] = await Promise.all([
      derived.characterIds.length
        ? fastify.prisma.characterOrTeam.findMany({
            where: { userId, id: { in: derived.characterIds } },
            select: { id: true, name: true, type: true }
          })
        : Promise.resolve([]),
      derived.teamIds.length
        ? fastify.prisma.characterOrTeam.findMany({
            where: { userId, id: { in: derived.teamIds } },
            select: { id: true, name: true, type: true }
          })
        : Promise.resolve([])
    ]);

    reply.send({
      startYear: derived.startYear,
      endYear: derived.endYear,
      status: derived.status,
      characters,
      teams
    });
  });

  fastify.get("/", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { q, status, era, importance, syncLevel, publisherId, sort, order } = request.query as {
      q?: string;
      status?: string;
      era?: string;
      importance?: string;
      syncLevel?: string;
      publisherId?: string;
      sort?: string;
      order?: string;
    };

    const { page, pageSize, skip, take } = getPagination(request.query as Record<string, any>);
    const userId = request.user!.id;

    const where: Record<string, any> = {
      userId,
      ...(status ? { status } : {}),
      ...(era ? { era } : {}),
      ...(importance ? { importance } : {}),
      ...(syncLevel ? { syncLevel } : {}),
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

    const sortFields = ["orderIndex", "name", "startYear", "status", "importance", "syncLevel", "createdAt"] as const;
    const sortField = sortFields.includes(sort as (typeof sortFields)[number])
      ? (sort as (typeof sortFields)[number])
      : "orderIndex";
    const sortOrder: "asc" | "desc" = order === "desc" ? "desc" : "asc";

    const [total, items] = await Promise.all([
      fastify.prisma.storyBlock.count({ where }),
      fastify.prisma.storyBlock.findMany({
        where,
        orderBy: { [sortField]: sortOrder },
        skip,
        take,
        include: {
          event: true,
          publisher: true,
          previousStoryBlock: true,
          storyBlockIssues: { include: { issue: true } },
          storyBlockCharacters: { include: { characterOrTeam: true } }
        }
      })
    ]);

    const withMetrics = items.map((storyBlock) => ({
      ...storyBlock,
      metrics: computeStoryBlockMetrics(storyBlock)
    }));

    reply.send({ items: withMetrics, page, pageSize, total });
  });

  fastify.post("/bulk", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const userId = request.user!.id;
    const body = request.body as {
      items?: Array<{
        name?: string;
        type?: string;
        era?: string | null;
        chronology?: string | null;
        publisherId?: string | null;
        publisherName?: string | null;
        startYear?: number | string;
        endYear?: number | string | null;
        importance?: string;
        syncLevel?: string;
        eventId?: string | null;
        eventName?: string | null;
        orderIndex?: number | string;
        status?: string;
        notes?: string | null;
      }>;
    };

    const items = body.items || [];
    if (!items.length) {
      reply.status(400).send({ error: "No items provided" });
      return;
    }

    const eventNames = Array.from(
      new Set(items.map((item) => item.eventName).filter((name): name is string => Boolean(name)))
    );
    const events = eventNames.length
      ? await fastify.prisma.event.findMany({
          where: { userId, name: { in: eventNames } }
        })
      : [];
    const eventMap = new Map(events.map((event) => [event.name, event.id]));

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

    const data: Prisma.StoryBlockCreateManyInput[] = [];
    items.forEach((item, index) => {
      const name = item.name?.trim();
      if (!name) {
        errors.push(`Row ${index + 1}: name is required`);
        return;
      }

      const type = StoryBlockTypeValues.includes(item.type as any) ? (item.type as any) : "ARC";
      const importance = StoryBlockImportanceValues.includes(item.importance as any)
        ? (item.importance as any)
        : "CORE";
      const syncLevel = SyncLevelValues.includes(item.syncLevel as any) ? (item.syncLevel as any) : "ISOLATED_0";
      const status = StoryBlockStatusValues.includes(item.status as any) ? (item.status as any) : "NOT_STARTED";

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

      const orderIndex = Number(item.orderIndex);
      if (Number.isNaN(orderIndex)) {
        errors.push(`Row ${index + 1}: orderIndex must be a number`);
        return;
      }

      const eventId = item.eventId || (item.eventName ? eventMap.get(item.eventName) : undefined);
      if (item.eventName && !eventId) {
        errors.push(`Row ${index + 1}: eventName not found`);
        return;
      }

      const publisherId =
        item.publisherId || (item.publisherName ? publisherMap.get(item.publisherName) : undefined);
      if (!publisherId) {
        errors.push(`Row ${index + 1}: publisherName is required`);
        return;
      }

      data.push({
        userId,
        name,
        type,
        era: item.era ?? null,
        chronology: item.chronology ?? null,
        startYear,
        endYear,
        importance,
        syncLevel,
        publisherId,
        eventId: eventId ?? null,
        orderIndex,
        status,
        notes: item.notes ?? null
      });
    });

    if (errors.length) {
      reply.status(400).send({ error: "Validation failed", details: errors });
      return;
    }

    const result = await fastify.prisma.storyBlock.createMany({
      data,
      skipDuplicates: true
    });

    reply.send({ imported: result.count, total: items.length });
  });

  fastify.post("/", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const body = storyBlockSchema.parse(request.body);
    const userId = request.user!.id;

    const relationCheck = await validateRelations(fastify.prisma, userId, body);
    if ("error" in relationCheck) {
      reply.status(400).send({ error: relationCheck.error });
      return;
    }

    const issueIds = body.issueIds ?? [];
    const derived = await deriveStoryBlockFromIssueIds(fastify.prisma, userId, issueIds);
    const startYear = derived.startYear ?? body.startYear;
    if (startYear === undefined || startYear === null) {
      reply.status(400).send({ error: "Start year is required when issues have no release dates." });
      return;
    }

    const endYear = derived.startYear !== null ? derived.endYear : body.endYear ?? null;

    const result = await fastify.prisma.$transaction(async (prisma) => {
      const created = await prisma.storyBlock.create({
        data: {
          userId,
          name: body.name,
          type: body.type,
          era: body.era ?? null,
          chronology: body.chronology ?? null,
          startYear,
          endYear,
          importance: body.importance,
          syncLevel: body.syncLevel,
          publisherId: relationCheck.publisherId,
          previousStoryBlockId: body.previousStoryBlockId ?? null,
          eventId: body.eventId ?? null,
          orderIndex: body.orderIndex,
          status: derived.status,
          notes: body.notes ?? null
        }
      });

      if (body.seriesIds?.length) {
        await prisma.storyBlockSeries.createMany({
          data: body.seriesIds.map((seriesId) => ({
            storyBlockId: created.id,
            seriesId
          })),
          skipDuplicates: true
        });
      }

      if (body.issueIds?.length) {
        await prisma.storyBlockIssue.createMany({
          data: body.issueIds.map((issueId) => ({
            storyBlockId: created.id,
            issueId
          })),
          skipDuplicates: true
        });
      }

      await syncStoryBlockDerived(prisma, userId, created.id, issueIds);

      return prisma.storyBlock.findUnique({
        where: { id: created.id },
        include: {
          event: true,
          publisher: true,
          storyBlockIssues: {
            include: {
              issue: {
                include: {
                  issueCharacters: { include: { characterOrTeam: true } },
                  issueEvents: true,
                  storyBlockIssues: true
                }
              }
            }
          },
          storyBlockCharacters: { include: { characterOrTeam: true } }
        }
      });
    });

    reply.status(201).send(result);
  });

  fastify.get("/:id", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.id;

    const storyBlock = await fastify.prisma.storyBlock.findFirst({
      where: { id, userId },
      include: {
        event: true,
        publisher: true,
        previousStoryBlock: true,
        storyBlockSeries: { include: { series: true } },
        storyBlockIssues: {
          include: {
            issue: {
              include: {
                series: true,
                issueCharacters: { include: { characterOrTeam: true } },
                issueEvents: true,
                storyBlockIssues: true
              }
            }
          }
        },
        storyBlockCharacters: { include: { characterOrTeam: true } }
      }
    });

    if (!storyBlock) {
      reply.status(404).send({ error: "Not found" });
      return;
    }

    const nextStoryBlock = await fastify.prisma.storyBlock.findFirst({
      where: { userId, previousStoryBlockId: storyBlock.id },
      orderBy: { orderIndex: "asc" }
    });

    reply.send({
      ...storyBlock,
      storyBlockIssues: [...storyBlock.storyBlockIssues].sort((a, b) => compareIssues(a.issue, b.issue)),
      metrics: computeStoryBlockMetrics(storyBlock),
      nextStoryBlock
    });
  });

  fastify.put("/:id", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = storyBlockSchema.parse(request.body);
    const userId = request.user!.id;

    const relationCheck = await validateRelations(fastify.prisma, userId, body, id);
    if ("error" in relationCheck) {
      reply.status(400).send({ error: relationCheck.error });
      return;
    }

    const result = await fastify.prisma.$transaction(async (prisma) => {
      const updated = await prisma.storyBlock.updateMany({
        where: { id, userId },
        data: {
          name: body.name,
          type: body.type,
          era: body.era ?? null,
          chronology: body.chronology ?? null,
          importance: body.importance,
          syncLevel: body.syncLevel,
          publisherId: relationCheck.publisherId,
          previousStoryBlockId: body.previousStoryBlockId ?? null,
          eventId: body.eventId ?? null,
          orderIndex: body.orderIndex,
          notes: body.notes ?? null
        }
      });

      if (updated.count === 0) {
        return null;
      }

      if (body.seriesIds) {
        await prisma.storyBlockSeries.deleteMany({ where: { storyBlockId: id } });
        if (body.seriesIds.length) {
          await prisma.storyBlockSeries.createMany({
            data: body.seriesIds.map((seriesId) => ({
              storyBlockId: id,
              seriesId
            })),
            skipDuplicates: true
          });
        }
      }

      if (body.issueIds) {
        await prisma.storyBlockIssue.deleteMany({ where: { storyBlockId: id } });
        if (body.issueIds.length) {
          await prisma.storyBlockIssue.createMany({
            data: body.issueIds.map((issueId) => ({
              storyBlockId: id,
              issueId
            })),
            skipDuplicates: true
          });
        }
      }

      await syncStoryBlockDerived(prisma, userId, id, body.issueIds);

      return prisma.storyBlock.findUnique({
        where: { id },
        include: {
          event: true,
          publisher: true,
          previousStoryBlock: true,
          storyBlockIssues: {
            include: {
              issue: {
                include: {
                  issueCharacters: { include: { characterOrTeam: true } },
                  issueEvents: true,
                  storyBlockIssues: true
                }
              }
            }
          },
          storyBlockCharacters: { include: { characterOrTeam: true } }
        }
      });
    });

    if (!result) {
      reply.status(404).send({ error: "Not found" });
      return;
    }

    reply.send({
      ...result,
      metrics: computeStoryBlockMetrics(result)
    });
  });

  fastify.delete("/:id", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.id;

    const deleted = await fastify.prisma.storyBlock.deleteMany({
      where: { id, userId }
    });

    if (deleted.count === 0) {
      reply.status(404).send({ error: "Not found" });
      return;
    }

    reply.send({ ok: true });
  });

  fastify.post("/:id/finish", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.id;

    const storyBlock = await fastify.prisma.storyBlock.findFirst({
      where: { id, userId },
      include: { storyBlockIssues: { select: { issueId: true } } }
    });

    if (!storyBlock) {
      reply.status(404).send({ error: "Not found" });
      return;
    }

    const issueIds = storyBlock.storyBlockIssues.map((link) => link.issueId);
    const result = issueIds.length
      ? await fastify.prisma.issue.updateMany({
          where: { id: { in: issueIds }, userId },
          data: { status: "FINISHED", readDate: new Date() }
        })
      : { count: 0 };

    await syncStoryBlockDerived(fastify.prisma, userId, id, issueIds);

    reply.send({ updated: result.count });
  });
}
