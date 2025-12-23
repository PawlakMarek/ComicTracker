import { FastifyInstance } from "fastify";
import { z } from "zod";

const mergeSchema = z.object({
  entity: z.enum(["publishers", "series", "characters", "events", "story-blocks", "issues"]),
  targetId: z.string().min(1),
  sourceIds: z.array(z.string()).min(1)
});

const createManySafe = async (model: any, data: any[]) => {
  if (!data.length) return;
  await model.createMany({ data, skipDuplicates: true });
};

const mergeIssueRelations = async (prisma: any, fromIssueId: string, toIssueId: string) => {
  const storyLinks = await prisma.storyBlockIssue.findMany({ where: { issueId: fromIssueId } });
  await createManySafe(
    prisma.storyBlockIssue,
    storyLinks.map((link: any) => ({ storyBlockId: link.storyBlockId, issueId: toIssueId }))
  );
  await prisma.storyBlockIssue.deleteMany({ where: { issueId: fromIssueId } });

  const characterLinks = await prisma.issueCharacter.findMany({ where: { issueId: fromIssueId } });
  await createManySafe(
    prisma.issueCharacter,
    characterLinks.map((link: any) => ({ issueId: toIssueId, characterOrTeamId: link.characterOrTeamId }))
  );
  await prisma.issueCharacter.deleteMany({ where: { issueId: fromIssueId } });

  const eventLinks = await prisma.issueEvent.findMany({ where: { issueId: fromIssueId } });
  await createManySafe(
    prisma.issueEvent,
    eventLinks.map((link: any) => ({ issueId: toIssueId, eventId: link.eventId }))
  );
  await prisma.issueEvent.deleteMany({ where: { issueId: fromIssueId } });

  const sessionLinks = await prisma.readingSessionIssue.findMany({ where: { issueId: fromIssueId } });
  await createManySafe(
    prisma.readingSessionIssue,
    sessionLinks.map((link: any) => ({ readingSessionId: link.readingSessionId, issueId: toIssueId }))
  );
  await prisma.readingSessionIssue.deleteMany({ where: { issueId: fromIssueId } });

  await prisma.issue.deleteMany({ where: { id: fromIssueId } });
};

export default async function mergeRoutes(fastify: FastifyInstance) {
  fastify.post("/", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const userId = request.user!.id;
    const body = mergeSchema.parse(request.body);

    const sourceIds = Array.from(new Set(body.sourceIds)).filter((id) => id !== body.targetId);
    if (!sourceIds.length) {
      reply.status(400).send({ error: "No source ids provided" });
      return;
    }

    const prisma = fastify.prisma;

    const result: { merged?: number; error?: string } = await prisma.$transaction(async (tx) => {
      switch (body.entity) {
        case "publishers": {
          const target = await tx.publisher.findFirst({ where: { id: body.targetId, userId } });
          if (!target) {
            return { error: "Target not found" };
          }

          const sources = await tx.publisher.findMany({ where: { userId, id: { in: sourceIds } } });
          if (!sources.length) {
            return { error: "Sources not found" };
          }

          await tx.series.updateMany({
            where: { userId, publisherId: { in: sourceIds } },
            data: { publisherId: body.targetId }
          });

          await tx.event.updateMany({
            where: { userId, publisherId: { in: sourceIds } },
            data: { publisherId: body.targetId }
          });

          await tx.characterOrTeam.updateMany({
            where: { userId, publisherId: { in: sourceIds } },
            data: { publisherId: body.targetId }
          });

          const deleted = await tx.publisher.deleteMany({ where: { userId, id: { in: sourceIds } } });
          return { merged: deleted.count };
        }
        case "series": {
          const target = await tx.series.findFirst({ where: { id: body.targetId, userId } });
          if (!target) {
            return { error: "Target not found" };
          }

          const sources = await tx.series.findMany({ where: { userId, id: { in: sourceIds } } });
          if (!sources.length) {
            return { error: "Sources not found" };
          }

          const sourceIssues = await tx.issue.findMany({
            where: { userId, seriesId: { in: sourceIds } }
          });

          for (const issue of sourceIssues) {
            const existing = await tx.issue.findFirst({
              where: { userId, seriesId: body.targetId, issueNumber: issue.issueNumber }
            });

            if (existing) {
              await mergeIssueRelations(tx, issue.id, existing.id);
            } else {
              await tx.issue.update({
                where: { id: issue.id },
                data: { seriesId: body.targetId }
              });
            }
          }

          const seriesLinks = await tx.storyBlockSeries.findMany({
            where: { seriesId: { in: sourceIds } }
          });
          await createManySafe(
            tx.storyBlockSeries,
            seriesLinks.map((link: any) => ({ storyBlockId: link.storyBlockId, seriesId: body.targetId }))
          );
          await tx.storyBlockSeries.deleteMany({ where: { seriesId: { in: sourceIds } } });

          const deleted = await tx.series.deleteMany({ where: { userId, id: { in: sourceIds } } });
          return { merged: deleted.count };
        }
        case "characters": {
          const target = await tx.characterOrTeam.findFirst({ where: { id: body.targetId, userId } });
          if (!target) {
            return { error: "Target not found" };
          }

          const sources = await tx.characterOrTeam.findMany({ where: { userId, id: { in: sourceIds } } });
          if (!sources.length) {
            return { error: "Sources not found" };
          }
          if (sources.some((source) => source.type !== target.type)) {
            return { error: "Character and team types must match" };
          }

          const storyLinks = await tx.storyBlockCharacter.findMany({
            where: { characterOrTeamId: { in: sourceIds } }
          });
          await createManySafe(
            tx.storyBlockCharacter,
            storyLinks.map((link: any) => ({ storyBlockId: link.storyBlockId, characterOrTeamId: body.targetId }))
          );
          await tx.storyBlockCharacter.deleteMany({ where: { characterOrTeamId: { in: sourceIds } } });

          const issueLinks = await tx.issueCharacter.findMany({
            where: { characterOrTeamId: { in: sourceIds } }
          });
          await createManySafe(
            tx.issueCharacter,
            issueLinks.map((link: any) => ({ issueId: link.issueId, characterOrTeamId: body.targetId }))
          );
          await tx.issueCharacter.deleteMany({ where: { characterOrTeamId: { in: sourceIds } } });

          if (target.type === "CHARACTER") {
            const teamLinks = await tx.characterTeam.findMany({
              where: { characterId: { in: sourceIds } }
            });
            await createManySafe(
              tx.characterTeam,
              teamLinks.map((link: any) => ({ characterId: body.targetId, teamId: link.teamId }))
            );
            await tx.characterTeam.deleteMany({ where: { characterId: { in: sourceIds } } });
          }

          if (target.type === "TEAM") {
            const memberLinks = await tx.characterTeam.findMany({
              where: { teamId: { in: sourceIds } }
            });
            await createManySafe(
              tx.characterTeam,
              memberLinks.map((link: any) => ({ characterId: link.characterId, teamId: body.targetId }))
            );
            await tx.characterTeam.deleteMany({ where: { teamId: { in: sourceIds } } });
          }

          const deleted = await tx.characterOrTeam.deleteMany({ where: { userId, id: { in: sourceIds } } });
          return { merged: deleted.count };
        }
        case "events": {
          const target = await tx.event.findFirst({ where: { id: body.targetId, userId } });
          if (!target) {
            return { error: "Target not found" };
          }

          const sources = await tx.event.findMany({ where: { userId, id: { in: sourceIds } } });
          if (!sources.length) {
            return { error: "Sources not found" };
          }

          await tx.storyBlock.updateMany({
            where: { userId, eventId: { in: sourceIds } },
            data: { eventId: body.targetId }
          });

          const issueLinks = await tx.issueEvent.findMany({ where: { eventId: { in: sourceIds } } });
          await createManySafe(
            tx.issueEvent,
            issueLinks.map((link: any) => ({ issueId: link.issueId, eventId: body.targetId }))
          );
          await tx.issueEvent.deleteMany({ where: { eventId: { in: sourceIds } } });

          const deleted = await tx.event.deleteMany({ where: { userId, id: { in: sourceIds } } });
          return { merged: deleted.count };
        }
        case "story-blocks": {
          const target = await tx.storyBlock.findFirst({ where: { id: body.targetId, userId } });
          if (!target) {
            return { error: "Target not found" };
          }

          const sources = await tx.storyBlock.findMany({ where: { userId, id: { in: sourceIds } } });
          if (!sources.length) {
            return { error: "Sources not found" };
          }

          const seriesLinks = await tx.storyBlockSeries.findMany({
            where: { storyBlockId: { in: sourceIds } }
          });
          await createManySafe(
            tx.storyBlockSeries,
            seriesLinks.map((link: any) => ({ storyBlockId: body.targetId, seriesId: link.seriesId }))
          );
          await tx.storyBlockSeries.deleteMany({ where: { storyBlockId: { in: sourceIds } } });

          const issueLinks = await tx.storyBlockIssue.findMany({
            where: { storyBlockId: { in: sourceIds } }
          });
          await createManySafe(
            tx.storyBlockIssue,
            issueLinks.map((link: any) => ({ storyBlockId: body.targetId, issueId: link.issueId }))
          );
          await tx.storyBlockIssue.deleteMany({ where: { storyBlockId: { in: sourceIds } } });

          const characterLinks = await tx.storyBlockCharacter.findMany({
            where: { storyBlockId: { in: sourceIds } }
          });
          await createManySafe(
            tx.storyBlockCharacter,
            characterLinks.map((link: any) => ({ storyBlockId: body.targetId, characterOrTeamId: link.characterOrTeamId }))
          );
          await tx.storyBlockCharacter.deleteMany({ where: { storyBlockId: { in: sourceIds } } });

          const deleted = await tx.storyBlock.deleteMany({ where: { userId, id: { in: sourceIds } } });
          return { merged: deleted.count };
        }
        case "issues": {
          const target = await tx.issue.findFirst({ where: { id: body.targetId, userId } });
          if (!target) {
            return { error: "Target not found" };
          }

          const sources = await tx.issue.findMany({ where: { userId, id: { in: sourceIds } } });
          if (!sources.length) {
            return { error: "Sources not found" };
          }

          for (const source of sources) {
            await mergeIssueRelations(tx, source.id, body.targetId);
          }

          return { merged: sources.length };
        }
        default:
          return { error: "Unsupported entity" };
      }
    });

    if (result.error) {
      reply.status(404).send({ error: result.error });
      return;
    }

    reply.send(result);
  });
}
