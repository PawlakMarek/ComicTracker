import { FastifyInstance } from "fastify";
import { computeStoryBlockMetrics } from "../services/storyBlockMetrics";
import { getSwitchSuggestion } from "../services/suggestions";
import { deriveReadingOrderStatus } from "../services/storyBlockDerived";

export default async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.get("/", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const userId = request.user!.id;

    const readingBlocks = await fastify.prisma.storyBlock.findMany({
      where: { userId, status: "READING" },
      orderBy: { orderIndex: "asc" },
      include: {
        storyBlockIssues: { include: { issue: true } },
        storyBlockCharacters: { include: { characterOrTeam: true } }
      }
    });

    const readingBlocksWithMetrics = readingBlocks.map((block) => ({
      ...block,
      metrics: computeStoryBlockMetrics(block),
      mainCharacters: block.storyBlockCharacters
        .map((link) => link.characterOrTeam)
        .filter((entry) => entry.currentTrackingPriority !== "NONE")
        .slice(0, 4)
    }));

    const highPriorityCharacters = await fastify.prisma.characterOrTeam.findMany({
      where: { userId, currentTrackingPriority: "HIGH" },
      orderBy: { name: "asc" }
    });

    const priorityWithNext = await Promise.all(
      highPriorityCharacters.map(async (character) => {
        const nextBlockLink = await fastify.prisma.storyBlockCharacter.findFirst({
          where: {
            characterOrTeamId: character.id,
            storyBlock: { status: { not: "FINISHED" }, userId }
          },
          include: { storyBlock: true },
          orderBy: { storyBlock: { orderIndex: "asc" } }
        });

        return {
          character,
          nextStoryBlock: nextBlockLink?.storyBlock ?? null
        };
      })
    );

    const upcomingEvents = await fastify.prisma.event.findMany({
      where: { userId },
      orderBy: { sequenceOrder: "asc" },
      take: 8
    });

    const suggestion = await getSwitchSuggestion(fastify, userId);

    const readingOrders = await fastify.prisma.readingOrder.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 6,
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

    const readingOrdersWithNext = readingOrders.map((order) => {
      const totalBlocks = order.items.length;
      const completedBlocks = order.items.filter((item) => item.storyBlock.status === "FINISHED").length;
      const nextItem = order.items.find((item) => item.storyBlock.status !== "FINISHED");
      const status = deriveReadingOrderStatus(order.items.map((item) => item.storyBlock.status));

      return {
        id: order.id,
        name: order.name,
        description: order.description,
        totalBlocks,
        completedBlocks,
        status,
        nextStoryBlock: nextItem
          ? {
              ...nextItem.storyBlock,
              metrics: computeStoryBlockMetrics(nextItem.storyBlock)
            }
          : null
      };
    });

    reply.send({
      readingBlocks: readingBlocksWithMetrics,
      highPriorityCharacters: priorityWithNext,
      upcomingEvents,
      suggestion,
      readingOrders: readingOrdersWithNext
    });
  });

  fastify.get("/suggestions", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const userId = request.user!.id;
    const { storyBlockId } = request.query as { storyBlockId?: string };

    const suggestion = await getSwitchSuggestion(fastify, userId, storyBlockId);
    reply.send(suggestion);
  });
}
