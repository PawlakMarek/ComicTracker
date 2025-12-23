import { CharacterType, IssueStatus, Prisma, PrismaClient, StoryBlockStatus } from "@prisma/client";

type IssueForDerive = {
  releaseDate: Date | null;
  seriesStartYear?: number | null;
  status: IssueStatus;
  issueCharacters: {
    characterOrTeamId: string;
    characterOrTeam: { type: CharacterType };
  }[];
};

const deriveStatus = (issues: IssueForDerive[]) => {
  if (!issues.length) return StoryBlockStatus.NOT_STARTED;

  const statuses = issues.map((issue) => issue.status);
  if (statuses.every((status) => status === IssueStatus.SKIPPED)) {
    return StoryBlockStatus.SKIPPED;
  }

  if (statuses.every((status) => status === IssueStatus.FINISHED || status === IssueStatus.SKIPPED)) {
    return StoryBlockStatus.FINISHED;
  }

  const hasStarted = statuses.some((status) => status !== IssueStatus.UNREAD);
  const hasUnfinished = statuses.some((status) => status !== IssueStatus.FINISHED);
  if (hasStarted && hasUnfinished) {
    return StoryBlockStatus.READING;
  }

  return StoryBlockStatus.NOT_STARTED;
};

export const deriveReadingOrderStatus = (statuses: StoryBlockStatus[]) => {
  if (!statuses.length) return StoryBlockStatus.NOT_STARTED;

  if (statuses.every((status) => status === StoryBlockStatus.SKIPPED)) {
    return StoryBlockStatus.SKIPPED;
  }

  if (
    statuses.every(
      (status) => status === StoryBlockStatus.FINISHED || status === StoryBlockStatus.SKIPPED
    )
  ) {
    return StoryBlockStatus.FINISHED;
  }

  const hasStarted = statuses.some((status) => status !== StoryBlockStatus.NOT_STARTED);
  const hasUnfinished = statuses.some((status) => status !== StoryBlockStatus.FINISHED);
  if (hasStarted && hasUnfinished) {
    return StoryBlockStatus.READING;
  }

  return StoryBlockStatus.NOT_STARTED;
};

export const deriveStoryBlockFromIssues = (issues: IssueForDerive[]) => {
  const years = issues
    .map((issue) =>
      issue.releaseDate ? issue.releaseDate.getUTCFullYear() : issue.seriesStartYear ?? null
    )
    .filter((year): year is number => year !== null);

  const startYear = years.length ? Math.min(...years) : null;
  const endYear = years.length ? Math.max(...years) : null;

  const characterIds = new Set<string>();
  const teamIds = new Set<string>();

  issues.forEach((issue) => {
    issue.issueCharacters.forEach((link) => {
      if (link.characterOrTeam.type === CharacterType.CHARACTER) {
        characterIds.add(link.characterOrTeamId);
      } else if (link.characterOrTeam.type === CharacterType.TEAM) {
        teamIds.add(link.characterOrTeamId);
      }
    });
  });

  return {
    startYear,
    endYear,
    status: deriveStatus(issues),
    characterIds: Array.from(characterIds),
    teamIds: Array.from(teamIds)
  };
};

export const deriveStoryBlockFromIssueIds = async (
  prisma: Prisma.TransactionClient | PrismaClient,
  userId: string,
  issueIds: string[]
) => {
  if (!issueIds.length) {
    return deriveStoryBlockFromIssues([]);
  }

  const issues = await prisma.issue.findMany({
    where: { userId, id: { in: issueIds } },
    select: {
      releaseDate: true,
      status: true,
      series: { select: { startYear: true } },
      issueCharacters: {
        select: {
          characterOrTeamId: true,
          characterOrTeam: { select: { type: true } }
        }
      }
    }
  });

  return deriveStoryBlockFromIssues(
    issues.map((issue) => ({
      releaseDate: issue.releaseDate,
      status: issue.status,
      seriesStartYear: issue.series?.startYear ?? null,
      issueCharacters: issue.issueCharacters
    }))
  );
};

export const syncStoryBlockDerived = async (
  prisma: Prisma.TransactionClient | PrismaClient,
  userId: string,
  storyBlockId: string,
  issueIds?: string[]
) => {
  const storyBlock = await prisma.storyBlock.findFirst({
    where: { id: storyBlockId, userId },
    select: { startYear: true, endYear: true }
  });

  if (!storyBlock) return null;

  const resolvedIssueIds =
    issueIds ??
    (
      await prisma.storyBlockIssue.findMany({
        where: { storyBlockId },
        select: { issueId: true }
      })
    ).map((link) => link.issueId);

  const derived = await deriveStoryBlockFromIssueIds(prisma, userId, resolvedIssueIds);

  const startYear = derived.startYear ?? storyBlock.startYear;
  const endYear = derived.startYear !== null ? derived.endYear : storyBlock.endYear ?? null;

  await prisma.storyBlock.update({
    where: { id: storyBlockId },
    data: {
      startYear,
      endYear,
      status: derived.status
    }
  });

  await prisma.storyBlockCharacter.deleteMany({ where: { storyBlockId } });

  const combinedCharacterIds = [...derived.characterIds, ...derived.teamIds];
  if (combinedCharacterIds.length) {
    await prisma.storyBlockCharacter.createMany({
      data: combinedCharacterIds.map((characterOrTeamId) => ({
        storyBlockId,
        characterOrTeamId
      })),
      skipDuplicates: true
    });
  }

  return derived;
};
