import { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { fetchComicVineDetail, fetchComicVineIssuesForVolume, sleep } from "./comicvine";
import { parseIssueNumber } from "../utils/issueSorting";

const splitAliasParts = (value: string) => {
  const normalized = value.replace(/<br\s*\/?>/gi, "\n").replace(/\r/g, "\n");
  const parts = normalized
    .split(/[\n,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    const single = parts[0] ?? "";
    if (single && single.split(/\s+/).length > 3) {
      const expanded = single
        .replace(/([a-z0-9])([A-Z])/g, "$1|$2")
        .replace(/([A-Z])([A-Z][a-z])/g, "$1|$2")
        .split("|")
        .map((entry) => entry.trim())
        .filter(Boolean);
      if (expanded.length > 1) {
        return expanded;
      }
    }
  }

  return parts;
};

const normalizeAliases = (
  value: string | string[] | null | undefined
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput => {
  if (!value) return Prisma.DbNull;
  const entries = Array.isArray(value) ? value : [value];
  const cleaned = entries.flatMap((entry) => splitAliasParts(entry));
  return cleaned.length ? cleaned : Prisma.DbNull;
};

const splitAliases = (value: unknown) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((entry) => splitAliasParts(String(entry)));
  }
  if (typeof value === "string") {
    return splitAliasParts(value);
  }
  return [];
};

const toAliasInput = (
  value: Prisma.JsonValue | null | undefined
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput => {
  if (value === null || value === undefined) return Prisma.DbNull;
  return value as Prisma.InputJsonValue;
};

const sanitizeComicVineText = (value: string | null | undefined) => {
  if (!value) return null;
  const stripped = value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return stripped || null;
};

const resolvePublisher = async (fastify: FastifyInstance, userId: string, data: any) => {
  const comicVineId = Number(data.id);
  const existingById = await fastify.prisma.publisher.findUnique({
    where: { userId_comicVineId: { userId, comicVineId } }
  });
  if (existingById) {
    return fastify.prisma.publisher.update({
      where: { id: existingById.id },
      data: {
        name: data.name,
        country: data.location || null,
        notes: data.deck || null
      }
    });
  }

  const existingByName = await fastify.prisma.publisher.findUnique({
    where: { userId_name: { userId, name: data.name } }
  });
  if (existingByName) {
    return fastify.prisma.publisher.update({
      where: { id: existingByName.id },
      data: {
        comicVineId,
        country: data.location || null,
        notes: data.deck || null
      }
    });
  }

  return fastify.prisma.publisher.create({
    data: {
      userId,
      name: data.name,
      comicVineId,
      country: data.location || null,
      notes: data.deck || null
    }
  });
};

const resolveCharacterOrTeam = async (
  fastify: FastifyInstance,
  userId: string,
  data: any,
  type: "CHARACTER" | "TEAM"
) => {
  const name = typeof data?.name === "string" ? data.name.trim() : "";
  if (!name) {
    throw new Error("Character credit missing name");
  }
  const publisherData = data?.publisher;
  const resolvedPublisher =
    publisherData?.id && publisherData?.name
      ? await resolvePublisher(fastify, userId, publisherData)
      : null;
  const publisherId = resolvedPublisher?.id;
  const comicVineId = data.id ? Number(data.id) : null;
  const existingById = comicVineId
    ? await fastify.prisma.characterOrTeam.findUnique({
        where: { userId_comicVineId: { userId, comicVineId } }
      })
    : null;
  if (existingById) {
    return fastify.prisma.characterOrTeam.update({
      where: { id: existingById.id },
      data: {
        name: name || existingById.name,
        aliases: data.aliases ? normalizeAliases(data.aliases) : toAliasInput(existingById.aliases),
        ...(publisherId ? { publisherId } : {}),
        realName: data.real_name ?? existingById.realName,
        continuity: data.universe?.name ?? existingById.continuity,
        majorStatusQuoNotes: data.deck ?? existingById.majorStatusQuoNotes
      }
    });
  }

  const existingByName = await fastify.prisma.characterOrTeam.findUnique({
    where: { userId_name_type: { userId, name, type } }
  });
  if (existingByName) {
    return fastify.prisma.characterOrTeam.update({
      where: { id: existingByName.id },
      data: {
        ...(comicVineId ? { comicVineId } : {}),
        aliases: data.aliases ? normalizeAliases(data.aliases) : toAliasInput(existingByName.aliases),
        ...(publisherId ? { publisherId } : {}),
        realName: data.real_name ?? existingByName.realName,
        continuity: data.universe?.name ?? existingByName.continuity,
        majorStatusQuoNotes: data.deck ?? existingByName.majorStatusQuoNotes
      }
    });
  }

  const existingByRealName = await fastify.prisma.characterOrTeam.findFirst({
    where: { userId, type, realName: { equals: name, mode: "insensitive" } }
  });
  if (existingByRealName) {
    return fastify.prisma.characterOrTeam.update({
      where: { id: existingByRealName.id },
      data: {
        ...(comicVineId ? { comicVineId } : {}),
        aliases: data.aliases ? normalizeAliases(data.aliases) : toAliasInput(existingByRealName.aliases),
        ...(publisherId ? { publisherId } : {}),
        realName: data.real_name ?? existingByRealName.realName,
        continuity: data.universe?.name ?? existingByRealName.continuity,
        majorStatusQuoNotes: data.deck ?? existingByRealName.majorStatusQuoNotes
      }
    });
  }

  const aliasCandidates = await fastify.prisma.characterOrTeam.findMany({
    where: { userId, type, aliases: { array_contains: [name] } }
  });
  let aliasMatch = aliasCandidates.find((candidate) =>
    splitAliases(candidate.aliases).some((alias) => alias.toLowerCase() === name.toLowerCase())
  );
  if (!aliasMatch) {
    const broadCandidates = await fastify.prisma.characterOrTeam.findMany({
      where: { userId, type }
    });
    aliasMatch = broadCandidates.find((candidate) =>
      splitAliases(candidate.aliases).some((alias) => alias.toLowerCase() === name.toLowerCase())
    );
  }
  if (aliasMatch) {
    return fastify.prisma.characterOrTeam.update({
      where: { id: aliasMatch.id },
      data: {
        ...(comicVineId ? { comicVineId } : {}),
        aliases: data.aliases ? normalizeAliases(data.aliases) : toAliasInput(aliasMatch.aliases),
        ...(publisherId ? { publisherId } : {}),
        realName: data.real_name ?? aliasMatch.realName,
        continuity: data.universe?.name ?? aliasMatch.continuity,
        majorStatusQuoNotes: data.deck ?? aliasMatch.majorStatusQuoNotes
      }
    });
  }

  return fastify.prisma.characterOrTeam.create({
    data: {
      userId,
      name,
      ...(comicVineId ? { comicVineId } : {}),
      aliases: normalizeAliases(data.aliases),
      publisherId: publisherId || null,
      realName: data.real_name || null,
      continuity: data.universe?.name || null,
      majorStatusQuoNotes: data.deck || null,
      currentTrackingPriority: "NONE",
      type
    }
  });
};

const resolveSeries = async (
  fastify: FastifyInstance,
  userId: string,
  data: any,
  fallbackPublisherId: string
) => {
  const comicVineId = Number(data.id);
  const updateData: Record<string, any> = {
    name: data.name,
    publisherId: fallbackPublisherId
  };
  if (data.start_year) updateData.startYear = Number(data.start_year);
  if (data.end_year) updateData.endYear = Number(data.end_year);
  if (data.location_credits?.[0]?.name) updateData.era = data.location_credits[0].name;
  if (data.deck) updateData.notes = data.deck;

  const existingById = await fastify.prisma.series.findUnique({
    where: { userId_comicVineId: { userId, comicVineId } }
  });
  if (existingById) {
    return fastify.prisma.series.update({
      where: { id: existingById.id },
      data: updateData
    });
  }

  const existingByName = await fastify.prisma.series.findUnique({
    where: { userId_name: { userId, name: data.name } }
  });
  if (existingByName) {
    return fastify.prisma.series.update({
      where: { id: existingByName.id },
      data: {
        ...updateData,
        comicVineId
      }
    });
  }

  return fastify.prisma.series.create({
    data: {
      userId,
      name: data.name,
      comicVineId,
      publisherId: fallbackPublisherId,
      startYear: data.start_year ? Number(data.start_year) : 2000,
      endYear: data.end_year ? Number(data.end_year) : null,
      era: data.location_credits?.[0]?.name || null,
      chronology: null,
      type: "ONGOING",
      notes: data.deck || null
    }
  });
};

const importComicVineResource = async (fastify: FastifyInstance, userId: string, resource: string, data: any) => {
  switch (resource) {
    case "publisher": {
      return resolvePublisher(fastify, userId, data);
    }
    case "volume": {
      const publisher = data.publisher ? await resolvePublisher(fastify, userId, data.publisher) : null;

      const fallbackPublisher =
        publisher ||
        (await fastify.prisma.publisher.upsert({
          where: { userId_name: { userId, name: "Unknown Publisher" } },
          update: {},
          create: { userId, name: "Unknown Publisher" }
        }));

      return resolveSeries(fastify, userId, data, fallbackPublisher.id);
    }
    case "issue": {
      const publisherData = data.volume?.publisher || data.publisher;
      const resolvedPublisher = publisherData
        ? await resolvePublisher(fastify, userId, publisherData)
        : null;
      const fallbackPublisherId =
        resolvedPublisher?.id ||
        (await fastify.prisma.publisher.findFirst({ where: { userId } }))?.id ||
        (await fastify.prisma.publisher.create({
          data: { userId, name: "Unknown Publisher" }
        })).id;
      const volume = data.volume ? await resolveSeries(fastify, userId, data.volume, fallbackPublisherId) : null;

      if (!volume) {
        throw new Error("Series/volume is required for issue import");
      }

      const comicVineId = Number(data.id);
      const issueNumber = String(data.issue_number || data.id);
      let issueRecord = await fastify.prisma.issue.findUnique({
        where: { userId_comicVineId: { userId, comicVineId } }
      });

      if (issueRecord) {
        issueRecord = await fastify.prisma.issue.update({
          where: { id: issueRecord.id },
          data: {
            seriesId: volume.id,
            issueNumber,
            issueNumberSort: parseIssueNumber(issueNumber),
            title: data.name || null,
            releaseDate: data.cover_date ? new Date(data.cover_date) : null,
            status: "UNREAD",
            notes: sanitizeComicVineText(data.description || data.deck)
          }
        });
      } else {
        const existingByNumber = await fastify.prisma.issue.findFirst({
          where: { userId, seriesId: volume.id, issueNumber }
        });
        if (existingByNumber) {
          issueRecord = await fastify.prisma.issue.update({
            where: { id: existingByNumber.id },
            data: {
              comicVineId,
              title: data.name || null,
              releaseDate: data.cover_date ? new Date(data.cover_date) : null,
              notes: sanitizeComicVineText(data.description || data.deck),
              issueNumberSort: parseIssueNumber(issueNumber)
            }
          });
        } else {
          issueRecord = await fastify.prisma.issue.create({
            data: {
              userId,
              seriesId: volume.id,
              comicVineId,
              issueNumber,
              issueNumberSort: parseIssueNumber(issueNumber),
              title: data.name || null,
              releaseDate: data.cover_date ? new Date(data.cover_date) : null,
              status: "UNREAD",
              notes: sanitizeComicVineText(data.description || data.deck)
            }
          });
        }
      }

      const characters = Array.isArray(data.character_credits) ? data.character_credits : [];
      const teams = Array.isArray(data.team_credits) ? data.team_credits : [];
      const characterIds: string[] = [];
      const teamIds: string[] = [];

      for (const credit of characters) {
        if (!credit?.name) continue;
        const entry = await resolveCharacterOrTeam(fastify, userId, credit, "CHARACTER");
        characterIds.push(entry.id);
      }

      for (const credit of teams) {
        if (!credit?.name) continue;
        const entry = await resolveCharacterOrTeam(fastify, userId, credit, "TEAM");
        teamIds.push(entry.id);
      }

      if (characterIds.length || teamIds.length) {
        await fastify.prisma.issueCharacter.createMany({
          data: [...characterIds, ...teamIds].map((characterOrTeamId) => ({
            issueId: issueRecord.id,
            characterOrTeamId
          })),
          skipDuplicates: true
        });
      }

      return issueRecord;
    }
    case "character": {
      return resolveCharacterOrTeam(fastify, userId, data, "CHARACTER");
    }
    case "team": {
      return resolveCharacterOrTeam(fastify, userId, data, "TEAM");
    }
    default:
      throw new Error(`Unsupported ComicVine resource: ${resource}`);
  }
};

const processComicVineJob = async (fastify: FastifyInstance, job: any) => {
  const settings = await fastify.prisma.userSetting.findUnique({ where: { userId: job.userId } });
  if (!settings?.comicVineApiKey) {
    throw new Error("ComicVine API key is missing");
  }

  const { resource, detailUrls, includeIssues } = job.payload as {
    resource: string;
    detailUrls: string[];
    includeIssues?: boolean;
  };
  const results: Array<{ id: string; name: string; type: string }> = [];
  let issuesImported = 0;
  let issuesAttempted = 0;

  for (const url of detailUrls) {
    const data = await fetchComicVineDetail(settings.comicVineApiKey, url);
    const imported = (await importComicVineResource(fastify, job.userId, resource, data)) as any;
    const label = "name" in imported ? imported.name : "issueNumber" in imported ? imported.issueNumber : "";
    results.push({ id: imported.id, name: label ?? "", type: resource });

    if (resource === "volume" && includeIssues) {
      const issueUrls = await fetchComicVineIssuesForVolume(settings.comicVineApiKey, Number(data.id));
      issuesAttempted += issueUrls.length;
      for (const issueUrl of issueUrls) {
        const issueData = await fetchComicVineDetail(settings.comicVineApiKey, issueUrl);
        const issueImported = (await importComicVineResource(fastify, job.userId, "issue", issueData)) as any;
        const issueLabel =
          "issueNumber" in issueImported ? `#${issueImported.issueNumber}` : issueImported.name || "";
        results.push({ id: issueImported.id, name: issueLabel ?? "", type: "issue" });
        issuesImported += 1;
        await sleep(1200);
      }
    }
    await sleep(1200);
  }

  return {
    imported: results.length,
    results,
    includeIssues: Boolean(includeIssues),
    issuesImported,
    issuesAttempted
  };
};

export const startJobWorker = (fastify: FastifyInstance) => {
  if (process.env.NODE_ENV === "test") return;

  const interval = setInterval(async () => {
    try {
      const job = await fastify.prisma.job.findFirst({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" }
      });

      if (!job) return;

      const claimed = await fastify.prisma.job.updateMany({
        where: { id: job.id, status: "PENDING" },
        data: { status: "RUNNING" }
      });

      if (claimed.count === 0) return;

      try {
        const result = job.type === "COMICVINE_IMPORT" ? await processComicVineJob(fastify, job) : undefined;
        await fastify.prisma.job.update({
          where: { id: job.id },
          data: {
            status: "COMPLETED",
            ...(result ? { result } : {})
          }
        });
      } catch (error) {
        await fastify.prisma.job.update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            error: error instanceof Error ? error.message : "Job failed"
          }
        });
      }
    } catch (error) {
      fastify.log.error(error);
    }
  }, 10000);

  fastify.addHook("onClose", () => {
    clearInterval(interval);
  });
};
