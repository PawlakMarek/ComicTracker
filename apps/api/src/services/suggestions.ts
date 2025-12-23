import { FastifyInstance } from "fastify";

export const getDominantCharacter = (session: any) => {
  const counts = new Map<string, { character: any; count: number }>();

  session.readingSessionIssues.forEach((link: any) => {
    link.issue.issueCharacters.forEach((appearance: any) => {
      const existing = counts.get(appearance.characterOrTeam.id);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(appearance.characterOrTeam.id, {
          character: appearance.characterOrTeam,
          count: 1
        });
      }
    });
  });

  return [...counts.values()].sort((a, b) => b.count - a.count)[0]?.character ?? null;
};

export const getSwitchSuggestion = async (
  fastify: FastifyInstance,
  userId: string,
  currentStoryBlockId?: string
) => {
  const recentSessions = await fastify.prisma.readingSession.findMany({
    where: { userId },
    orderBy: { sessionDate: "desc" },
    take: 5,
    include: {
      readingSessionIssues: {
        include: {
          issue: {
            include: {
              issueCharacters: { include: { characterOrTeam: true } }
            }
          }
        }
      }
    }
  });

  const dominantHistory = recentSessions.map((session) => getDominantCharacter(session)).filter(Boolean);
  const dominantId = dominantHistory[0]?.id;
  const lastThreeSame =
    dominantHistory.length >= 3 && dominantHistory.slice(0, 3).every((char) => char?.id === dominantId);

  if (!lastThreeSame || !dominantId) {
    return { shouldSwitch: false, reason: "Recent sessions are varied." };
  }

  const lastSession = recentSessions[0];
  const currentBlock = currentStoryBlockId
    ? await fastify.prisma.storyBlock.findFirst({
        where: { id: currentStoryBlockId, userId },
        include: { storyBlockIssues: true }
      })
    : await fastify.prisma.storyBlock.findFirst({
        where: { userId, status: "READING" },
        orderBy: { orderIndex: "asc" },
        include: { storyBlockIssues: true }
      });

  const isLongBlock = currentBlock ? currentBlock.storyBlockIssues.length > 25 : false;
  const fatigueHigh = lastSession?.fatigueLevel === "MEDIUM" || lastSession?.fatigueLevel === "HIGH";

  if (!isLongBlock && !fatigueHigh) {
    return { shouldSwitch: false, reason: "Streak is stable and fatigue is low." };
  }

  const candidates = await fastify.prisma.storyBlockCharacter.findMany({
    where: {
      characterOrTeam: { currentTrackingPriority: "HIGH", id: { not: dominantId } },
      storyBlock: {
        userId,
        status: { notIn: ["FINISHED", "READING"] },
        ...(currentBlock ? { id: { not: currentBlock.id } } : {})
      }
    },
    include: {
      storyBlock: true,
      characterOrTeam: true
    },
    orderBy: { storyBlock: { orderIndex: "asc" } }
  });

  const candidate = candidates[0];

  if (!candidate) {
    return { shouldSwitch: true, reason: "Fatigue detected but no alternate block found." };
  }

  return {
    shouldSwitch: true,
    reason: isLongBlock
      ? "Long story block and repeated focus detected."
      : "Fatigue detected in recent sessions.",
    candidate: {
      storyBlock: candidate.storyBlock,
      character: candidate.characterOrTeam
    }
  };
};
