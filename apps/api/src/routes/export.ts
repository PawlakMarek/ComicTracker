import { FastifyInstance } from "fastify";

const exportHandlers: Record<string, (fastify: FastifyInstance, userId: string) => Promise<any>> = {
  publishers: (fastify, userId) => fastify.prisma.publisher.findMany({ where: { userId } }),
  series: (fastify, userId) => fastify.prisma.series.findMany({ where: { userId } }),
  characters: (fastify, userId) => fastify.prisma.characterOrTeam.findMany({ where: { userId } }),
  events: (fastify, userId) => fastify.prisma.event.findMany({ where: { userId } }),
  "story-blocks": (fastify, userId) =>
    fastify.prisma.storyBlock.findMany({
      where: { userId },
      include: {
        storyBlockSeries: true,
        storyBlockIssues: true,
        storyBlockCharacters: true
      }
    }),
  issues: (fastify, userId) =>
    fastify.prisma.issue.findMany({
      where: { userId },
      include: {
        storyBlockIssues: true,
        issueCharacters: true,
        issueEvents: true
      }
    }),
  sessions: (fastify, userId) =>
    fastify.prisma.readingSession.findMany({
      where: { userId },
      include: {
        readingSessionIssues: true
      }
    })
};

export default async function exportRoutes(fastify: FastifyInstance) {
  fastify.get("/:entity", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { entity } = request.params as { entity: string };
    const userId = request.user!.id;

    const handler = exportHandlers[entity];
    if (!handler) {
      reply.status(400).send({ error: "Unsupported export entity" });
      return;
    }

    const data = await handler(fastify, userId);
    reply.send({ entity, data });
  });
}
