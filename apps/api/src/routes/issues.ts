import { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getPagination } from "../utils/pagination";
import { parseIssueNumber } from "../utils/issueSorting";
import { IssueStatusValues } from "../utils/enums";
import { syncStoryBlockDerived } from "../services/storyBlockDerived";

const issueSchema = z.object({
  seriesId: z.string().min(1),
  issueNumber: z.string().min(1),
  title: z.string().nullable().optional(),
  releaseDate: z.string().nullable().optional(),
  readingOrderIndex: z.number().int().nullable().optional(),
  status: z.enum(IssueStatusValues),
  readDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  storyBlockIds: z.array(z.string()).optional(),
  characterIds: z.array(z.string()).optional(),
  teamIds: z.array(z.string()).optional(),
  eventIds: z.array(z.string()).optional()
});

const getIssueNumberSort = (issueNumber: string) => parseIssueNumber(issueNumber);

export default async function issueRoutes(fastify: FastifyInstance) {
  fastify.get("/range", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { seriesId, start, end } = request.query as { seriesId?: string; start?: string; end?: string };
    const userId = request.user!.id;

    if (!seriesId || !start || !end) {
      reply.status(400).send({ error: "seriesId, start, and end are required" });
      return;
    }

    const startSort = getIssueNumberSort(start);
    const endSort = getIssueNumberSort(end);

    if (startSort === null || endSort === null || Number.isNaN(startSort) || Number.isNaN(endSort)) {
      reply.status(400).send({ error: "Start and end must be valid issue numbers" });
      return;
    }

    const min = Math.min(startSort, endSort);
    const max = Math.max(startSort, endSort);

    const items = await fastify.prisma.issue.findMany({
      where: {
        userId,
        seriesId,
        issueNumberSort: { gte: min, lte: max }
      },
      orderBy: [{ issueNumberSort: "asc" }, { issueNumber: "asc" }],
      include: { series: true }
    });

    reply.send({ items });
  });

  fastify.get("/", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { q, status, seriesId, sort, order } = request.query as {
      q?: string;
      status?: string;
      seriesId?: string;
      sort?: string;
      order?: string;
    };

    const { page, pageSize, skip, take } = getPagination(request.query as Record<string, any>);
    const userId = request.user!.id;

    const where: Record<string, any> = {
      userId,
      ...(seriesId ? { seriesId } : {}),
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { issueNumber: { contains: q, mode: "insensitive" as const } },
              { title: { contains: q, mode: "insensitive" as const } },
              { series: { name: { contains: q, mode: "insensitive" as const } } }
            ]
          }
        : {})
    };

    const sortOrder: Prisma.SortOrder = order === "desc" ? "desc" : "asc";
    const orderBy: Prisma.IssueOrderByWithRelationInput[] = (() => {
      switch (sort) {
        case "title":
          return [{ title: sortOrder }, { issueNumberSort: "asc" }, { issueNumber: "asc" }];
        case "status":
          return [{ status: sortOrder }, { issueNumberSort: "asc" }, { issueNumber: "asc" }];
        case "releaseDate":
          return [{ releaseDate: sortOrder }, { issueNumberSort: "asc" }, { issueNumber: "asc" }];
        case "readingOrderIndex":
          return [{ readingOrderIndex: sortOrder }, { issueNumberSort: "asc" }, { issueNumber: "asc" }];
        case "series":
          return [{ series: { name: sortOrder } }, { issueNumberSort: "asc" }, { issueNumber: "asc" }];
        case "issueNumber":
          return [{ issueNumberSort: sortOrder }, { issueNumber: sortOrder }];
        default:
          return [{ readingOrderIndex: sortOrder }, { issueNumberSort: sortOrder }, { issueNumber: sortOrder }];
      }
    })();

    const [total, items] = await Promise.all([
      fastify.prisma.issue.count({ where }),
      fastify.prisma.issue.findMany({
        where,
        orderBy,
        skip,
        take,
        include: { series: true }
      })
    ]);

    reply.send({ items, page, pageSize, total });
  });

  fastify.post("/bulk", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const userId = request.user!.id;
    const body = request.body as {
      items?: Array<{
        seriesId?: string;
        seriesName?: string;
        issueNumber?: string;
        title?: string | null;
        releaseDate?: string | null;
        readingOrderIndex?: number | string | null;
        status?: string;
        readDate?: string | null;
        notes?: string | null;
      }>;
    };

    const items = body.items || [];
    if (!items.length) {
      reply.status(400).send({ error: "No items provided" });
      return;
    }

    const seriesNames = Array.from(
      new Set(items.map((item) => item.seriesName).filter((name): name is string => Boolean(name)))
    );

    const seriesByName = seriesNames.length
      ? await fastify.prisma.series.findMany({
          where: { userId, name: { in: seriesNames } }
        })
      : [];

    const seriesMap = new Map(seriesByName.map((series) => [series.name, series.id]));
    const errors: string[] = [];

    const data: Prisma.IssueCreateManyInput[] = [];
    items.forEach((item, index) => {
      const issueNumber = item.issueNumber?.trim();
      if (!issueNumber) {
        errors.push(`Row ${index + 1}: issueNumber is required`);
        return;
      }

      const seriesId = item.seriesId || (item.seriesName ? seriesMap.get(item.seriesName) : undefined);
      if (!seriesId) {
        errors.push(`Row ${index + 1}: seriesId or valid seriesName is required`);
        return;
      }

      const readingOrder =
        item.readingOrderIndex === null || item.readingOrderIndex === undefined || item.readingOrderIndex === ""
          ? null
          : Number(item.readingOrderIndex);

      if (readingOrder !== null && Number.isNaN(readingOrder)) {
        errors.push(`Row ${index + 1}: readingOrderIndex must be a number`);
        return;
      }

      data.push({
        userId,
        seriesId,
        issueNumber,
        issueNumberSort: getIssueNumberSort(issueNumber),
        title: item.title ?? null,
        releaseDate: item.releaseDate ? new Date(item.releaseDate) : null,
        readingOrderIndex: readingOrder,
        status: IssueStatusValues.includes(item.status as any) ? (item.status as any) : "UNREAD",
        readDate: item.readDate ? new Date(item.readDate) : null,
        notes: item.notes ?? null
      });
    });

    if (errors.length) {
      reply.status(400).send({ error: "Validation failed", details: errors });
      return;
    }

    const result = await fastify.prisma.issue.createMany({
      data,
      skipDuplicates: true
    });

    reply.send({ imported: result.count, total: items.length });
  });

  fastify.post("/", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const body = issueSchema.parse(request.body);
    const userId = request.user!.id;

    const result = await fastify.prisma.$transaction(async (prisma) => {
      const created = await prisma.issue.create({
        data: {
          userId,
          seriesId: body.seriesId,
          issueNumber: body.issueNumber,
          issueNumberSort: getIssueNumberSort(body.issueNumber),
          title: body.title ?? null,
          releaseDate: body.releaseDate ? new Date(body.releaseDate) : null,
          readingOrderIndex: body.readingOrderIndex ?? null,
          status: body.status,
          readDate: body.readDate ? new Date(body.readDate) : null,
          notes: body.notes ?? null
        }
      });

      if (body.storyBlockIds?.length) {
        await prisma.storyBlockIssue.createMany({
          data: body.storyBlockIds.map((storyBlockId) => ({
            storyBlockId,
            issueId: created.id
          })),
          skipDuplicates: true
        });
      }

      if (body.characterIds?.length) {
        await prisma.issueCharacter.createMany({
          data: body.characterIds.map((characterId) => ({
            issueId: created.id,
            characterOrTeamId: characterId
          })),
          skipDuplicates: true
        });
      }

      if (body.teamIds?.length) {
        await prisma.issueCharacter.createMany({
          data: body.teamIds.map((teamId) => ({
            issueId: created.id,
            characterOrTeamId: teamId
          })),
          skipDuplicates: true
        });
      }

      if (body.eventIds?.length) {
        await prisma.issueEvent.createMany({
          data: body.eventIds.map((eventId) => ({
            issueId: created.id,
            eventId
          })),
          skipDuplicates: true
        });
      }

      return created;
    });

    if (body.storyBlockIds?.length) {
      await Promise.all(
        body.storyBlockIds.map((storyBlockId) => syncStoryBlockDerived(fastify.prisma, userId, storyBlockId))
      );
    }

    reply.status(201).send(result);
  });

  fastify.get("/:id", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.id;

    const issue = await fastify.prisma.issue.findFirst({
      where: { id, userId },
      include: {
        series: true,
        storyBlockIssues: { include: { storyBlock: true } },
        issueCharacters: { include: { characterOrTeam: true } },
        issueEvents: { include: { event: true } }
      }
    });

    if (!issue) {
      reply.status(404).send({ error: "Not found" });
      return;
    }

    reply.send(issue);
  });

  fastify.put("/:id", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = issueSchema.parse(request.body);
    const userId = request.user!.id;

    const existingLinks = await fastify.prisma.storyBlockIssue.findMany({
      where: { issueId: id },
      select: { storyBlockId: true }
    });
    const existingStoryBlockIds = existingLinks.map((link) => link.storyBlockId);

    const result = await fastify.prisma.$transaction(async (prisma) => {
      const updated = await prisma.issue.updateMany({
        where: { id, userId },
        data: {
          seriesId: body.seriesId,
          issueNumber: body.issueNumber,
          issueNumberSort: getIssueNumberSort(body.issueNumber),
          title: body.title ?? null,
          releaseDate: body.releaseDate ? new Date(body.releaseDate) : null,
          readingOrderIndex: body.readingOrderIndex ?? null,
          status: body.status,
          readDate: body.readDate ? new Date(body.readDate) : null,
          notes: body.notes ?? null
        }
      });

      if (updated.count === 0) {
        return null;
      }

      if (body.storyBlockIds) {
        await prisma.storyBlockIssue.deleteMany({ where: { issueId: id } });
        if (body.storyBlockIds.length) {
          await prisma.storyBlockIssue.createMany({
            data: body.storyBlockIds.map((storyBlockId) => ({
              storyBlockId,
              issueId: id
            })),
            skipDuplicates: true
          });
        }
      }

      if (body.characterIds) {
        await prisma.issueCharacter.deleteMany({ where: { issueId: id } });
        if (body.characterIds.length) {
          await prisma.issueCharacter.createMany({
            data: body.characterIds.map((characterId) => ({
              issueId: id,
              characterOrTeamId: characterId
            })),
            skipDuplicates: true
          });
        }
      }

      if (body.teamIds) {
        if (!body.characterIds) {
          await prisma.issueCharacter.deleteMany({ where: { issueId: id } });
        }
        if (body.teamIds.length) {
          await prisma.issueCharacter.createMany({
            data: body.teamIds.map((teamId) => ({
              issueId: id,
              characterOrTeamId: teamId
            })),
            skipDuplicates: true
          });
        }
      }

      if (body.eventIds) {
        await prisma.issueEvent.deleteMany({ where: { issueId: id } });
        if (body.eventIds.length) {
          await prisma.issueEvent.createMany({
            data: body.eventIds.map((eventId) => ({
              issueId: id,
              eventId
            })),
            skipDuplicates: true
          });
        }
      }

      return prisma.issue.findUnique({
        where: { id },
        include: {
          series: true,
          storyBlockIssues: { include: { storyBlock: true } },
          issueCharacters: { include: { characterOrTeam: true } },
          issueEvents: { include: { event: true } }
        }
      });
    });

    if (!result) {
      reply.status(404).send({ error: "Not found" });
      return;
    }

    const nextStoryBlockIds = body.storyBlockIds ?? existingStoryBlockIds;
    const affectedStoryBlockIds = Array.from(new Set([...existingStoryBlockIds, ...nextStoryBlockIds]));

    if (affectedStoryBlockIds.length) {
      await Promise.all(
        affectedStoryBlockIds.map((storyBlockId) => syncStoryBlockDerived(fastify.prisma, userId, storyBlockId))
      );
    }

    reply.send(result);
  });

  fastify.delete("/:id", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.id;

    const existingLinks = await fastify.prisma.storyBlockIssue.findMany({
      where: { issueId: id },
      select: { storyBlockId: true }
    });
    const affectedStoryBlockIds = existingLinks.map((link) => link.storyBlockId);

    const deleted = await fastify.prisma.issue.deleteMany({
      where: { id, userId }
    });

    if (deleted.count === 0) {
      reply.status(404).send({ error: "Not found" });
      return;
    }

    if (affectedStoryBlockIds.length) {
      await Promise.all(
        affectedStoryBlockIds.map((storyBlockId) => syncStoryBlockDerived(fastify.prisma, userId, storyBlockId))
      );
    }

    reply.send({ ok: true });
  });
}
