export const parseIssueNumber = (value: string) => {
  const normalized = value.replace(/[^0-9.]/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export const getIssueSortValue = (issue: { issueNumber: string; issueNumberSort?: number | null }) => {
  if (issue.issueNumberSort !== null && issue.issueNumberSort !== undefined) {
    return issue.issueNumberSort;
  }
  return parseIssueNumber(issue.issueNumber);
};

export const compareIssues = (
  a: { readingOrderIndex?: number | null; issueNumber: string; issueNumberSort?: number | null },
  b: { readingOrderIndex?: number | null; issueNumber: string; issueNumberSort?: number | null }
) => {
  const indexA = a.readingOrderIndex ?? Number.POSITIVE_INFINITY;
  const indexB = b.readingOrderIndex ?? Number.POSITIVE_INFINITY;

  if (indexA !== indexB) return indexA - indexB;

  const numA = getIssueSortValue(a);
  const numB = getIssueSortValue(b);

  if (numA !== null && numB !== null && numA !== numB) {
    return numA - numB;
  }

  return a.issueNumber.localeCompare(b.issueNumber, undefined, { numeric: true });
};
