import { IssueStatus, PrismaClient, StoryBlock } from "@prisma/client";
import { compareIssues } from "../utils/issueSorting";

export const computeStoryBlockMetrics = (storyBlock: StoryBlock & { storyBlockIssues: { issue: any }[] }) => {
  const issues = storyBlock.storyBlockIssues.map((link) => link.issue);
  const totalIssues = issues.length;
  const finishedIssues = issues.filter((issue) => issue.status === IssueStatus.FINISHED).length;
  const completionPercent = totalIssues === 0 ? 0 : Math.round((finishedIssues / totalIssues) * 100);

  const nextIssue = issues
    .filter((issue) => issue.status === IssueStatus.UNREAD)
    .sort(compareIssues)[0] ?? null;

  return {
    totalIssues,
    finishedIssues,
    completionPercent,
    nextIssue
  };
};

export const fetchStoryBlockMetrics = async (prisma: PrismaClient, userId: string, storyBlockId: string) => {
  const storyBlock = await prisma.storyBlock.findFirst({
    where: { id: storyBlockId, userId },
    include: {
      storyBlockIssues: {
        include: {
          issue: true
        }
      }
    }
  });

  if (!storyBlock) return null;

  return {
    ...storyBlock,
    metrics: computeStoryBlockMetrics(storyBlock)
  };
};
