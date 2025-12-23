import { FastifyInstance } from "fastify";
import { z } from "zod";
import { getPagination } from "../utils/pagination";
import { FatigueLevelValues } from "../utils/enums";
import { getSwitchSuggestion } from "../services/suggestions";
import { syncStoryBlockDerived } from "../services/storyBlockDerived";

const sessionSchema = z.object({
  sessionDate: z.string().min(1),
  durationMinutes: z.number().int().min(1),
  fatigueLevel: z.enum(FatigueLevelValues),
  notes: z.string().nullable().optional(),
  issueIds: z.array(z.string()).optional()
});

const computeSessionInsights = (session: any) => {
  const issues = session.readingSessionIssues.map((link: any) => link.issue);
  const storyBlockMap = new Map<string, any>();
  const characterCounts = new Map<string, { character: any; count: number }>();

  issues.forEach((issue: any) => {
    issue.storyBlockIssues.forEach((link: any) => {
      storyBlockMap.set(link.storyBlock.id, link.storyBlock);
    });

    issue.issueCharacters.forEach((link: any) => {
      const existing = characterCounts.get(link.characterOrTeam.id);
      if (existing) {
        existing.count += 1;
      } else {
        characterCounts.set(link.characterOrTeam.id, {
          character: link.characterOrTeam,
          count: 1
        });
      }
    });
  });

  const dominant = [...characterCounts.values()].sort((a, b) => b.count - a.count)[0] ?? null;

  return {
    issues,
    storyBlocks: Array.from(storyBlockMap.values()),
    dominantCharacter: dominant?.character ?? null
  };
};

export default async function sessionRoutes(fastify: FastifyInstance) {
  fastify.get("/", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { from, to } = request.query as { from?: string; to?: string };
    const { page, pageSize, skip, take } = getPagination(request.query as Record<string, any>);
    const userId = request.user!.id;

    const where: Record<string, any> = {
      userId,
      ...(from || to
        ? {
            sessionDate: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {})
            }
          }
        : {})
    };

    const [total, items] = await Promise.all([
      fastify.prisma.readingSession.count({ where }),
      fastify.prisma.readingSession.findMany({
        where,
        orderBy: { sessionDate: "desc" },
        skip,
        take,
        include: { readingSessionIssues: { include: { issue: true } } }
      })
    ]);

    reply.send({ items, page, pageSize, total });
  });

  fastify.post("/", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const body = sessionSchema.parse(request.body);
    const userId = request.user!.id;

    const created = await fastify.prisma.$transaction(async (prisma) => {
      const session = await prisma.readingSession.create({
        data: {
          userId,
          sessionDate: new Date(body.sessionDate),
          durationMinutes: body.durationMinutes,
          fatigueLevel: body.fatigueLevel,
          notes: body.notes ?? null
        }
      });

      if (body.issueIds?.length) {
        await prisma.readingSessionIssue.createMany({
          data: body.issueIds.map((issueId) => ({
            readingSessionId: session.id,
            issueId
          })),
          skipDuplicates: true
        });

        await prisma.issue.updateMany({
          where: { id: { in: body.issueIds }, userId },
          data: {
            status: "FINISHED",
            readDate: new Date(body.sessionDate)
          }
        });
      }

      return session;
    });

    if (body.issueIds?.length) {
      const storyBlockLinks = await fastify.prisma.storyBlockIssue.findMany({
        where: { issueId: { in: body.issueIds } },
        select: { storyBlockId: true }
      });
      const storyBlockIds = Array.from(new Set(storyBlockLinks.map((link) => link.storyBlockId)));
      if (storyBlockIds.length) {
        await Promise.all(
          storyBlockIds.map((storyBlockId) =>
            syncStoryBlockDerived(fastify.prisma, userId, storyBlockId)
          )
        );
      }
    }

    reply.status(201).send(created);
  });

  fastify.get("/:id", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.id;

    const session = await fastify.prisma.readingSession.findFirst({
      where: { id, userId },
      include: {
        readingSessionIssues: {
          include: {
            issue: {
              include: {
                series: true,
                issueCharacters: { include: { characterOrTeam: true } },
                storyBlockIssues: { include: { storyBlock: true } }
              }
            }
          }
        }
      }
    });

    if (!session) {
      reply.status(404).send({ error: "Not found" });
      return;
    }

    const insights = computeSessionInsights(session);
    const suggestion = await getSwitchSuggestion(fastify, userId);

    reply.send({
      ...session,
      ...insights,
      suggestion
    });
  });

  fastify.put("/:id", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = sessionSchema.parse(request.body);
    const userId = request.user!.id;

    const result = await fastify.prisma.$transaction(async (prisma) => {
      const updated = await prisma.readingSession.updateMany({
        where: { id, userId },
        data: {
          sessionDate: new Date(body.sessionDate),
          durationMinutes: body.durationMinutes,
          fatigueLevel: body.fatigueLevel,
          notes: body.notes ?? null
        }
      });

      if (updated.count === 0) return null;

      if (body.issueIds) {
        await prisma.readingSessionIssue.deleteMany({ where: { readingSessionId: id } });
        if (body.issueIds.length) {
          await prisma.readingSessionIssue.createMany({
            data: body.issueIds.map((issueId) => ({
              readingSessionId: id,
              issueId
            })),
            skipDuplicates: true
          });

          await prisma.issue.updateMany({
            where: { id: { in: body.issueIds }, userId },
            data: {
              status: "FINISHED",
              readDate: new Date(body.sessionDate)
            }
          });
        }
      }

      return prisma.readingSession.findUnique({ where: { id } });
    });

    if (!result) {
      reply.status(404).send({ error: "Not found" });
      return;
    }

    if (body.issueIds?.length) {
      const storyBlockLinks = await fastify.prisma.storyBlockIssue.findMany({
        where: { issueId: { in: body.issueIds } },
        select: { storyBlockId: true }
      });
      const storyBlockIds = Array.from(new Set(storyBlockLinks.map((link) => link.storyBlockId)));
      if (storyBlockIds.length) {
        await Promise.all(
          storyBlockIds.map((storyBlockId) =>
            syncStoryBlockDerived(fastify.prisma, userId, storyBlockId)
          )
        );
      }
    }

    reply.send(result);
  });

  fastify.delete("/:id", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.id;

    const deleted = await fastify.prisma.readingSession.deleteMany({
      where: { id, userId }
    });

    if (deleted.count === 0) {
      reply.status(404).send({ error: "Not found" });
      return;
    }

    reply.send({ ok: true });
  });
}
