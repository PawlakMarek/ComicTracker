import { FastifyInstance } from "fastify";

export default async function statsRoutes(fastify: FastifyInstance) {
  fastify.get("/", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const userId = request.user!.id;
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [
      publishers,
      series,
      storyBlocks,
      issues,
      events,
      sessions,
      characters,
      teams,
      issuesFinished,
      storyBlocksFinished,
      storyBlocksReading
    ] = await Promise.all([
      fastify.prisma.publisher.count({ where: { userId } }),
      fastify.prisma.series.count({ where: { userId } }),
      fastify.prisma.storyBlock.count({ where: { userId } }),
      fastify.prisma.issue.count({ where: { userId } }),
      fastify.prisma.event.count({ where: { userId } }),
      fastify.prisma.readingSession.count({ where: { userId } }),
      fastify.prisma.characterOrTeam.count({ where: { userId, type: "CHARACTER" } }),
      fastify.prisma.characterOrTeam.count({ where: { userId, type: "TEAM" } }),
      fastify.prisma.issue.count({ where: { userId, status: "FINISHED" } }),
      fastify.prisma.storyBlock.count({ where: { userId, status: "FINISHED" } }),
      fastify.prisma.storyBlock.count({ where: { userId, status: "READING" } })
    ]);

    const recentSessions = await fastify.prisma.readingSession.findMany({
      where: { userId, sessionDate: { gte: since } },
      select: { durationMinutes: true, fatigueLevel: true }
    });

    const fatigueBreakdown = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      UNKNOWN: 0
    };

    let totalMinutes = 0;
    recentSessions.forEach((session) => {
      totalMinutes += session.durationMinutes;
      fatigueBreakdown[session.fatigueLevel] = (fatigueBreakdown[session.fatigueLevel] || 0) + 1;
    });

    const avgDurationMinutes = recentSessions.length ? Math.round(totalMinutes / recentSessions.length) : 0;

    reply.send({
      counts: {
        publishers,
        series,
        storyBlocks,
        issues,
        events,
        sessions,
        characters,
        teams
      },
      issues: {
        total: issues,
        finished: issuesFinished,
        completionPercent: issues ? Math.round((issuesFinished / issues) * 100) : 0
      },
      storyBlocks: {
        total: storyBlocks,
        reading: storyBlocksReading,
        finished: storyBlocksFinished
      },
      sessions: {
        last30Days: recentSessions.length,
        avgDurationMinutes,
        fatigueBreakdown
      }
    });
  });
}
