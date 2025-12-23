import { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getPagination } from "../utils/pagination";
import { CharacterTypeValues, TrackingPriorityValues } from "../utils/enums";
import { getDominantCharacter } from "../services/suggestions";

const characterSchema = z.object({
  name: z.string().min(1),
  realName: z.string().nullable().optional(),
  type: z.enum(CharacterTypeValues),
  publisherId: z.string().nullable().optional(),
  aliases: z.union([z.string(), z.array(z.string())]).nullable().optional(),
  continuity: z.string().nullable().optional(),
  majorStatusQuoNotes: z.string().nullable().optional(),
  currentTrackingPriority: z.enum(TrackingPriorityValues),
  teamIds: z.array(z.string()).optional(),
  memberIds: z.array(z.string()).optional()
});

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

export default async function characterRoutes(fastify: FastifyInstance) {
  fastify.get("/", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { q, publisherId, type, priority, sort, order } = request.query as {
      q?: string;
      publisherId?: string;
      type?: string;
      priority?: string;
      sort?: string;
      order?: string;
    };

    const { page, pageSize, skip, take } = getPagination(request.query as Record<string, any>);
    const userId = request.user!.id;

    const queryText = q?.trim();
    const where: Record<string, any> = {
      userId,
      ...(publisherId ? { publisherId } : {}),
      ...(type ? { type } : {}),
      ...(priority ? { currentTrackingPriority: priority } : {}),
      ...(queryText
        ? {
            OR: [
              { name: { contains: queryText, mode: "insensitive" as const } },
              { realName: { contains: queryText, mode: "insensitive" as const } },
              { aliases: { array_contains: [queryText] } }
            ]
          }
        : {})
    };

    const sortFields = ["name", "type", "currentTrackingPriority", "createdAt"] as const;
    const sortField = sortFields.includes(sort as (typeof sortFields)[number]) ? (sort as (typeof sortFields)[number]) : "name";
    const sortOrder: Prisma.SortOrder = order === "desc" ? "desc" : "asc";
    const orderBy: Prisma.CharacterOrTeamOrderByWithRelationInput = { [sortField]: sortOrder };

    const [total, items] = await Promise.all([
      fastify.prisma.characterOrTeam.count({ where }),
      fastify.prisma.characterOrTeam.findMany({
        where,
        orderBy,
        skip,
        take,
        include: { publisher: true }
      })
    ]);

    reply.send({ items, page, pageSize, total });
  });

  fastify.post("/bulk", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const userId = request.user!.id;
    const body = request.body as {
      items?: Array<{
        name?: string;
        realName?: string;
        type?: string;
        publisherId?: string;
        publisherName?: string;
        aliases?: string | null;
        continuity?: string | null;
        majorStatusQuoNotes?: string | null;
        currentTrackingPriority?: string;
      }>;
    };

    const items = body.items || [];
    if (!items.length) {
      reply.status(400).send({ error: "No items provided" });
      return;
    }

    const publisherNames = Array.from(
      new Set(items.map((item) => item.publisherName).filter((name): name is string => Boolean(name)))
    );

    if (publisherNames.length) {
      const existing = await fastify.prisma.publisher.findMany({
        where: { userId, name: { in: publisherNames } }
      });
      const existingNames = new Set(existing.map((publisher) => publisher.name));
      const missing = publisherNames.filter((name) => !existingNames.has(name));
      if (missing.length) {
        await fastify.prisma.publisher.createMany({
          data: missing.map((name) => ({ userId, name })),
          skipDuplicates: true
        });
      }
    }

    const publishers = publisherNames.length
      ? await fastify.prisma.publisher.findMany({
          where: { userId, name: { in: publisherNames } }
        })
      : [];
    const publisherMap = new Map(publishers.map((publisher) => [publisher.name, publisher.id]));

    const errors: string[] = [];

    const data: Prisma.CharacterOrTeamCreateManyInput[] = [];
    items.forEach((item, index) => {
      const name = item.name?.trim();
      if (!name) {
        errors.push(`Row ${index + 1}: name is required`);
        return;
      }

      const type = CharacterTypeValues.includes(item.type as any) ? (item.type as any) : "CHARACTER";
      const currentTrackingPriority = TrackingPriorityValues.includes(item.currentTrackingPriority as any)
        ? (item.currentTrackingPriority as any)
        : "NONE";

      const publisherId = item.publisherId || (item.publisherName ? publisherMap.get(item.publisherName) : undefined);

      data.push({
        userId,
        name,
        realName: item.realName ?? null,
        type,
        publisherId: publisherId ?? null,
        aliases: normalizeAliases(item.aliases ?? null),
        continuity: item.continuity ?? null,
        majorStatusQuoNotes: item.majorStatusQuoNotes ?? null,
        currentTrackingPriority
      });
    });

    if (errors.length) {
      reply.status(400).send({ error: "Validation failed", details: errors });
      return;
    }

    const result = await fastify.prisma.characterOrTeam.createMany({
      data,
      skipDuplicates: true
    });

    reply.send({ imported: result.count, total: items.length });
  });

  fastify.post("/", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const body = characterSchema.parse(request.body);
    const userId = request.user!.id;

    const created = await fastify.prisma.$transaction(async (prisma) => {
      const entry = await prisma.characterOrTeam.create({
        data: {
          userId,
          name: body.name,
          realName: body.realName ?? null,
          type: body.type,
          publisherId: body.publisherId ?? null,
          aliases: normalizeAliases(body.aliases),
          continuity: body.continuity ?? null,
          majorStatusQuoNotes: body.majorStatusQuoNotes ?? null,
          currentTrackingPriority: body.currentTrackingPriority
        }
      });

      if (body.teamIds?.length && body.type === "CHARACTER") {
        const teams = await prisma.characterOrTeam.findMany({
          where: { userId, id: { in: body.teamIds }, type: "TEAM" }
        });
        await prisma.characterTeam.createMany({
          data: teams.map((team) => ({ characterId: entry.id, teamId: team.id })),
          skipDuplicates: true
        });
      }

      if (body.memberIds?.length && body.type === "TEAM") {
        const members = await prisma.characterOrTeam.findMany({
          where: { userId, id: { in: body.memberIds }, type: "CHARACTER" }
        });
        await prisma.characterTeam.createMany({
          data: members.map((member) => ({ characterId: member.id, teamId: entry.id })),
          skipDuplicates: true
        });
      }

      return entry;
    });

    reply.status(201).send(created);
  });

  fastify.get("/:id", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.id;

    const character = await fastify.prisma.characterOrTeam.findFirst({
      where: { id, userId },
      include: {
        publisher: true,
        storyBlockCharacters: { include: { storyBlock: true } },
        characterTeams: { include: { team: true } },
        teamMembers: { include: { character: true } }
      }
    });

    if (!character) {
      reply.status(404).send({ error: "Not found" });
      return;
    }

    const recentSessions = await fastify.prisma.readingSession.findMany({
      where: { userId },
      orderBy: { sessionDate: "desc" },
      take: 10,
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

    const dominantSessions = recentSessions
      .filter((session) => getDominantCharacter(session)?.id === character.id)
      .slice(0, 5)
      .map((session) => ({
        id: session.id,
        sessionDate: session.sessionDate,
        fatigueLevel: session.fatigueLevel,
        durationMinutes: session.durationMinutes
      }));

    reply.send({ ...character, dominantSessions });
  });

  fastify.put("/:id", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = characterSchema.parse(request.body);
    const userId = request.user!.id;

    const updated = await fastify.prisma.$transaction(async (prisma) => {
      const result = await prisma.characterOrTeam.updateMany({
        where: { id, userId },
        data: {
          name: body.name,
          realName: body.realName ?? null,
          type: body.type,
          publisherId: body.publisherId ?? null,
          aliases: normalizeAliases(body.aliases),
          continuity: body.continuity ?? null,
          majorStatusQuoNotes: body.majorStatusQuoNotes ?? null,
          currentTrackingPriority: body.currentTrackingPriority
        }
      });

      if (body.type === "CHARACTER") {
        await prisma.characterTeam.deleteMany({ where: { teamId: id } });
      }

      if (body.type === "TEAM") {
        await prisma.characterTeam.deleteMany({ where: { characterId: id } });
      }

      if (body.teamIds && body.type === "CHARACTER") {
        await prisma.characterTeam.deleteMany({ where: { characterId: id } });
        if (body.teamIds.length) {
          const teams = await prisma.characterOrTeam.findMany({
            where: { userId, id: { in: body.teamIds }, type: "TEAM" }
          });
          await prisma.characterTeam.createMany({
            data: teams.map((team) => ({ characterId: id, teamId: team.id })),
            skipDuplicates: true
          });
        }
      }

      if (body.memberIds && body.type === "TEAM") {
        await prisma.characterTeam.deleteMany({ where: { teamId: id } });
        if (body.memberIds.length) {
          const members = await prisma.characterOrTeam.findMany({
            where: { userId, id: { in: body.memberIds }, type: "CHARACTER" }
          });
          await prisma.characterTeam.createMany({
            data: members.map((member) => ({ characterId: member.id, teamId: id })),
            skipDuplicates: true
          });
        }
      }

      return result;
    });

    if (updated.count === 0) {
      reply.status(404).send({ error: "Not found" });
      return;
    }

    const result = await fastify.prisma.characterOrTeam.findUnique({ where: { id } });
    reply.send(result);
  });

  fastify.delete("/:id", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.id;

    const deleted = await fastify.prisma.characterOrTeam.deleteMany({
      where: { id, userId }
    });

    if (deleted.count === 0) {
      reply.status(404).send({ error: "Not found" });
      return;
    }

    reply.send({ ok: true });
  });
}
