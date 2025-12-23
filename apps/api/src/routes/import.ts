import { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { parse } from "csv-parse/sync";
import {
  CharacterTypeValues,
  IssueStatusValues,
  SeriesTypeValues,
  StoryBlockImportanceValues,
  StoryBlockStatusValues,
  StoryBlockTypeValues,
  SyncLevelValues,
  TrackingPriorityValues
} from "../utils/enums";
import { parseDate, parseList, parseNumber } from "../utils/parse";
import { parseIssueNumber } from "../utils/issueSorting";
import { syncStoryBlockDerived } from "../services/storyBlockDerived";

const parseMultipart = async (request: any) => {
  const parts = request.parts();
  let fileBuffer: Buffer | null = null;
  let filename = "";
  let mimetype = "";
  let mapping: Record<string, string> | null = null;

  for await (const part of parts) {
    if (part.type === "file") {
      filename = part.filename || "upload";
      mimetype = part.mimetype;
      fileBuffer = await part.toBuffer();
    } else if (part.fieldname === "mapping") {
      mapping = part.value ? JSON.parse(part.value) : null;
    }
  }

  if (!fileBuffer) {
    throw new Error("File upload missing");
  }

  return { fileBuffer, filename, mimetype, mapping };
};

const parseRows = (buffer: Buffer, filename: string, mimetype: string) => {
  const isJson = mimetype.includes("json") || filename.toLowerCase().endsWith(".json");

  if (isJson) {
    const parsed = JSON.parse(buffer.toString("utf-8"));
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.items)) return parsed.items;
    throw new Error("JSON must be an array or { items: [] }");
  }

  return parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });
};

const getValue = (row: Record<string, any>, path: string) => {
  if (!path) return undefined;
  return path.split(".").reduce((acc, key) => (acc ? acc[key] : undefined), row);
};

const applyMapping = (row: Record<string, any>, mapping?: Record<string, string> | null) => {
  if (!mapping) return row;
  const mapped: Record<string, any> = {};
  for (const [field, column] of Object.entries(mapping)) {
    mapped[field] = getValue(row, column);
  }
  return mapped;
};

const validateEnum = (value: string | undefined, allowed: readonly string[], label: string, errors: string[]) => {
  if (!value) return;
  if (!allowed.includes(value)) {
    errors.push(`${label} must be one of: ${allowed.join(", ")}`);
  }
};

const previewRow = (row: Record<string, any>, errors: string[]) => ({
  data: row,
  errors
});

const parseIssueToken = (token: string) => {
  const [seriesName, issueNumber] = token.split("#").map((value) => value.trim());
  if (!seriesName || !issueNumber) return null;
  return { seriesName, issueNumber };
};

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

const buildPreview = (entity: string, rows: Record<string, any>[], mapping: Record<string, string> | null) => {
  const errors: string[] = [];

  const preview = rows.slice(0, 10).map((raw, index) => {
    const mapped = applyMapping(raw, mapping);
    const rowErrors: string[] = [];

    switch (entity) {
      case "publishers":
        if (!mapped.name) rowErrors.push("name is required");
        break;
      case "series":
        if (!mapped.name) rowErrors.push("name is required");
        if (!mapped.publisher) rowErrors.push("publisher is required");
        if (!mapped.startYear) rowErrors.push("startYear is required");
        if (!mapped.type) rowErrors.push("type is required");
        validateEnum(mapped.type, SeriesTypeValues, "type", rowErrors);
        break;
      case "characters":
        if (!mapped.name) rowErrors.push("name is required");
        if (!mapped.type) rowErrors.push("type is required");
        validateEnum(mapped.type, CharacterTypeValues, "type", rowErrors);
        if (mapped.currentTrackingPriority) {
          validateEnum(mapped.currentTrackingPriority, TrackingPriorityValues, "currentTrackingPriority", rowErrors);
        }
        break;
      case "events":
        if (!mapped.name) rowErrors.push("name is required");
        if (!mapped.publisher) rowErrors.push("publisher is required");
        if (!mapped.startYear) rowErrors.push("startYear is required");
        if (mapped.sequenceOrder === undefined) rowErrors.push("sequenceOrder is required");
        break;
      case "story-blocks":
        if (!mapped.name) rowErrors.push("name is required");
        if (!mapped.type) rowErrors.push("type is required");
        if (!mapped.publisher) rowErrors.push("publisher is required");
        if (!mapped.startYear) rowErrors.push("startYear is required");
        if (!mapped.importance) rowErrors.push("importance is required");
        if (!mapped.syncLevel) rowErrors.push("syncLevel is required");
        if (mapped.orderIndex === undefined) rowErrors.push("orderIndex is required");
        if (!mapped.status) rowErrors.push("status is required");
        validateEnum(mapped.type, StoryBlockTypeValues, "type", rowErrors);
        validateEnum(mapped.importance, StoryBlockImportanceValues, "importance", rowErrors);
        validateEnum(mapped.syncLevel, SyncLevelValues, "syncLevel", rowErrors);
        validateEnum(mapped.status, StoryBlockStatusValues, "status", rowErrors);
        break;
      case "issues":
        if (!mapped.series) rowErrors.push("series is required");
        if (!mapped.issueNumber) rowErrors.push("issueNumber is required");
        if (mapped.status) validateEnum(mapped.status, IssueStatusValues, "status", rowErrors);
        break;
      default:
        rowErrors.push("Unsupported entity");
    }

    if (rowErrors.length) {
      errors.push(`Row ${index + 1}: ${rowErrors.join("; ")}`);
    }

    return previewRow(mapped, rowErrors);
  });

  return { preview, errors };
};

export default async function importRoutes(fastify: FastifyInstance) {
  fastify.post("/:entity/preview", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { entity } = request.params as { entity: string };

    const { fileBuffer, filename, mimetype, mapping } = await parseMultipart(request);
    const rows = parseRows(fileBuffer, filename, mimetype);

    const { preview, errors } = buildPreview(entity, rows, mapping);

    reply.send({
      entity,
      totalRows: rows.length,
      preview,
      errors
    });
  });

  fastify.post("/:entity/commit", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { entity } = request.params as { entity: string };
    const userId = request.user!.id;

    const { fileBuffer, filename, mimetype, mapping } = await parseMultipart(request);
    const rows = parseRows(fileBuffer, filename, mimetype);

    const { preview, errors } = buildPreview(entity, rows, mapping);

    if (errors.length) {
      reply.status(400).send({ error: "Validation failed", errors });
      return;
    }

    const results: any[] = [];

    for (const raw of rows) {
      const row = applyMapping(raw, mapping);

      switch (entity) {
        case "publishers": {
          const created = await fastify.prisma.publisher.upsert({
            where: { userId_name: { userId, name: row.name } },
            update: {
              country: row.country ?? null,
              notes: row.notes ?? null
            },
            create: {
              userId,
              name: row.name,
              country: row.country ?? null,
              notes: row.notes ?? null
            }
          });
          results.push(created);
          break;
        }
        case "series": {
          const publisher = await fastify.prisma.publisher.upsert({
            where: { userId_name: { userId, name: row.publisher } },
            update: {},
            create: { userId, name: row.publisher }
          });

          const created = await fastify.prisma.series.upsert({
            where: { userId_name: { userId, name: row.name } },
            update: {
              publisherId: publisher.id,
              startYear: Number(row.startYear),
              endYear: parseNumber(row.endYear),
              era: parseList(row.era),
              type: row.type,
              notes: row.notes ?? null
            },
            create: {
              userId,
              publisherId: publisher.id,
              name: row.name,
              startYear: Number(row.startYear),
              endYear: parseNumber(row.endYear),
              era: parseList(row.era),
              type: row.type,
              notes: row.notes ?? null
            }
          });
          results.push(created);
          break;
        }
        case "characters": {
          const publisher = row.publisher
            ? await fastify.prisma.publisher.upsert({
                where: { userId_name: { userId, name: row.publisher } },
                update: {},
                create: { userId, name: row.publisher }
              })
            : null;

          const created = await fastify.prisma.characterOrTeam.upsert({
            where: { userId_name_type: { userId, name: row.name, type: row.type } },
            update: {
              publisherId: publisher?.id ?? null,
              aliases: normalizeAliases(row.aliases),
              realName: row.realName ?? null,
              continuity: row.continuity ?? null,
              majorStatusQuoNotes: row.majorStatusQuoNotes ?? null,
              currentTrackingPriority: row.currentTrackingPriority || "NONE"
            },
            create: {
              userId,
              name: row.name,
              type: row.type,
              publisherId: publisher?.id ?? null,
              aliases: normalizeAliases(row.aliases),
              realName: row.realName ?? null,
              continuity: row.continuity ?? null,
              majorStatusQuoNotes: row.majorStatusQuoNotes ?? null,
              currentTrackingPriority: row.currentTrackingPriority || "NONE"
            }
          });

          const teamNames = parseList(row.teams);
          if (teamNames.length && row.type === "CHARACTER") {
            const teams = await Promise.all(
              teamNames.map((name) =>
                fastify.prisma.characterOrTeam.upsert({
                  where: { userId_name_type: { userId, name, type: "TEAM" } },
                  update: {},
                  create: { userId, name, type: "TEAM", currentTrackingPriority: "NONE" }
                })
              )
            );
            await fastify.prisma.characterTeam.createMany({
              data: teams.map((team) => ({ characterId: created.id, teamId: team.id })),
              skipDuplicates: true
            });
          }

          results.push(created);
          break;
        }
        case "events": {
          const publisher = await fastify.prisma.publisher.upsert({
            where: { userId_name: { userId, name: row.publisher } },
            update: {},
            create: { userId, name: row.publisher }
          });

          const created = await fastify.prisma.event.upsert({
            where: { userId_name: { userId, name: row.name } },
            update: {
              publisherId: publisher.id,
              startYear: Number(row.startYear),
              endYear: parseNumber(row.endYear),
              sequenceOrder: Number(row.sequenceOrder),
              notes: row.notes ?? null
            },
            create: {
              userId,
              publisherId: publisher.id,
              name: row.name,
              startYear: Number(row.startYear),
              endYear: parseNumber(row.endYear),
              sequenceOrder: Number(row.sequenceOrder),
              notes: row.notes ?? null
            }
          });
          results.push(created);
          break;
        }
        case "story-blocks": {
          let event = null;
          let publisherId: string | null = null;
          if (row.publisher) {
            const publisher = await fastify.prisma.publisher.upsert({
              where: { userId_name: { userId, name: row.publisher } },
              update: {},
              create: { userId, name: row.publisher }
            });
            publisherId = publisher.id;
          }

          if (row.event) {
            event = await fastify.prisma.event.findFirst({ where: { userId, name: row.event } });
            if (!event) {
              if (!row.publisher) {
                throw new Error(`Publisher is required to create event: ${row.event}`);
              }
              const publisher = await fastify.prisma.publisher.upsert({
                where: { userId_name: { userId, name: row.publisher } },
                update: {},
                create: { userId, name: row.publisher }
              });
              publisherId = publisher.id;
              event = await fastify.prisma.event.create({
                data: {
                  userId,
                  publisherId: publisher.id,
                  name: row.event,
                  startYear: Number(row.startYear),
                  sequenceOrder: Number(row.orderIndex),
                  notes: "Imported placeholder"
                }
              });
            }
          }

          const seriesNames = parseList(row.series);
          if (!publisherId && seriesNames.length) {
            const series = await fastify.prisma.series.findMany({
              where: { userId, name: { in: seriesNames } },
              select: { publisherId: true }
            });
            const publisherIds = Array.from(new Set(series.map((entry) => entry.publisherId)));
            if (publisherIds.length === 1) {
              publisherId = publisherIds[0];
            } else if (publisherIds.length > 1) {
              throw new Error("Story block series span multiple publishers. Provide a publisher.");
            }
          }

          if (!publisherId) {
            throw new Error("Publisher is required for story blocks.");
          }

          const storyBlock = await fastify.prisma.storyBlock.upsert({
            where: { userId_name: { userId, name: row.name } },
            update: {
              type: row.type,
              era: row.era ?? null,
              chronology: row.chronology ?? null,
              startYear: Number(row.startYear),
              endYear: parseNumber(row.endYear),
              importance: row.importance,
              syncLevel: row.syncLevel,
              publisherId,
              eventId: event?.id ?? null,
              orderIndex: Number(row.orderIndex),
              status: row.status,
              notes: row.notes ?? null
            },
            create: {
              userId,
              name: row.name,
              type: row.type,
              era: row.era ?? null,
              chronology: row.chronology ?? null,
              startYear: Number(row.startYear),
              endYear: parseNumber(row.endYear),
              importance: row.importance,
              syncLevel: row.syncLevel,
              publisherId,
              eventId: event?.id ?? null,
              orderIndex: Number(row.orderIndex),
              status: row.status,
              notes: row.notes ?? null
            }
          });

          if (seriesNames.length) {
            const series = await fastify.prisma.series.findMany({
              where: { userId, name: { in: seriesNames }, publisherId }
            });
            await fastify.prisma.storyBlockSeries.createMany({
              data: series.map((entry) => ({ storyBlockId: storyBlock.id, seriesId: entry.id })),
              skipDuplicates: true
            });
          }

          const characterNames = parseList(row.characters);
          if (characterNames.length) {
            for (const name of characterNames) {
              const character = await fastify.prisma.characterOrTeam.upsert({
                where: { userId_name_type: { userId, name, type: "CHARACTER" } },
                update: {},
                create: {
                  userId,
                  name,
                  type: "CHARACTER",
                  currentTrackingPriority: "NONE"
                }
              });

              await fastify.prisma.storyBlockCharacter.createMany({
                data: [{ storyBlockId: storyBlock.id, characterOrTeamId: character.id }],
                skipDuplicates: true
              });
            }
          }

          const teamNames = parseList(row.teams);
          if (teamNames.length) {
            for (const name of teamNames) {
              const team = await fastify.prisma.characterOrTeam.upsert({
                where: { userId_name_type: { userId, name, type: "TEAM" } },
                update: {},
                create: {
                  userId,
                  name,
                  type: "TEAM",
                  currentTrackingPriority: "NONE"
                }
              });

              await fastify.prisma.storyBlockCharacter.createMany({
                data: [{ storyBlockId: storyBlock.id, characterOrTeamId: team.id }],
                skipDuplicates: true
              });
            }
          }

          const issueTokens = parseList(row.issues).map((token) => parseIssueToken(token)).filter(Boolean) as any[];
          for (const token of issueTokens) {
            const issue = await fastify.prisma.issue.findFirst({
              where: {
                userId,
                issueNumber: token.issueNumber,
                series: { name: token.seriesName }
              }
            });
            if (issue) {
              await fastify.prisma.storyBlockIssue.createMany({
                data: [{ storyBlockId: storyBlock.id, issueId: issue.id }],
                skipDuplicates: true
              });
            }
          }

          await syncStoryBlockDerived(fastify.prisma, userId, storyBlock.id);

          results.push(storyBlock);
          break;
        }
        case "issues": {
          const series = await fastify.prisma.series.findFirst({
            where: { userId, name: row.series }
          });
          if (!series) {
            throw new Error(`Series not found: ${row.series}`);
          }

          const issue = await fastify.prisma.issue.upsert({
            where: {
              userId_seriesId_issueNumber: {
                userId,
                seriesId: series.id,
                issueNumber: row.issueNumber
              }
            },
            update: {
              title: row.title ?? null,
              releaseDate: parseDate(row.releaseDate),
              readingOrderIndex: parseNumber(row.readingOrderIndex),
              status: row.status || "UNREAD",
              readDate: parseDate(row.readDate),
              notes: row.notes ?? null,
              issueNumberSort: parseIssueNumber(row.issueNumber)
            },
            create: {
              userId,
              seriesId: series.id,
              issueNumber: row.issueNumber,
              issueNumberSort: parseIssueNumber(row.issueNumber),
              title: row.title ?? null,
              releaseDate: parseDate(row.releaseDate),
              readingOrderIndex: parseNumber(row.readingOrderIndex),
              status: row.status || "UNREAD",
              readDate: parseDate(row.readDate),
              notes: row.notes ?? null
            }
          });

          const storyBlockNames = parseList(row.storyBlocks);
          if (storyBlockNames.length) {
            const blocks = await fastify.prisma.storyBlock.findMany({
              where: { userId, name: { in: storyBlockNames } }
            });
            await fastify.prisma.storyBlockIssue.createMany({
              data: blocks.map((block) => ({ storyBlockId: block.id, issueId: issue.id })),
              skipDuplicates: true
            });
          }

          const characterNames = parseList(row.characters);
          for (const name of characterNames) {
            const character = await fastify.prisma.characterOrTeam.upsert({
              where: { userId_name_type: { userId, name, type: "CHARACTER" } },
              update: {},
              create: { userId, name, type: "CHARACTER", currentTrackingPriority: "NONE" }
            });
            await fastify.prisma.issueCharacter.createMany({
              data: [{ issueId: issue.id, characterOrTeamId: character.id }],
              skipDuplicates: true
            });
          }

          const teamNames = parseList(row.teams);
          for (const name of teamNames) {
            const team = await fastify.prisma.characterOrTeam.upsert({
              where: { userId_name_type: { userId, name, type: "TEAM" } },
              update: {},
              create: { userId, name, type: "TEAM", currentTrackingPriority: "NONE" }
            });
            await fastify.prisma.issueCharacter.createMany({
              data: [{ issueId: issue.id, characterOrTeamId: team.id }],
              skipDuplicates: true
            });
          }

          const eventNames = parseList(row.events);
          for (const name of eventNames) {
            const event = await fastify.prisma.event.upsert({
              where: { userId_name: { userId, name } },
              update: {},
              create: {
                userId,
                publisherId: series.publisherId,
                name,
                startYear: series.startYear,
                sequenceOrder: 0,
                notes: "Imported placeholder"
              }
            });
            await fastify.prisma.issueEvent.createMany({
              data: [{ issueId: issue.id, eventId: event.id }],
              skipDuplicates: true
            });
          }

          results.push(issue);
          break;
        }
        default:
          reply.status(400).send({ error: "Unsupported import entity" });
          return;
      }
    }

    reply.send({ entity, imported: results.length, preview });
  });
}
