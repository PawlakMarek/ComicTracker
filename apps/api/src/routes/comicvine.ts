import { FastifyInstance } from "fastify";
import { z } from "zod";
import { searchComicVine } from "../services/comicvine";

const searchSchema = z.object({
  query: z.string().min(1),
  resource: z.enum(["publisher", "volume", "issue", "character", "team"])
});

const importSchema = z.object({
  resource: z.enum(["publisher", "volume", "issue", "character", "team"]),
  detailUrls: z.array(z.string().url()).min(1),
  includeIssues: z.boolean().optional()
});

export default async function comicVineRoutes(fastify: FastifyInstance) {
  fastify.get("/search", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { query, resource } = searchSchema.parse(request.query);
    const userId = request.user!.id;

    const settings = await fastify.prisma.userSetting.findUnique({ where: { userId } });
    if (!settings?.comicVineApiKey) {
      reply.status(400).send({ error: "ComicVine API key is missing" });
      return;
    }

    try {
      const results = await searchComicVine(settings.comicVineApiKey, query, resource);

      reply.send({
        results: results.map((item: any) => ({
          id: item.id,
          name: item.name,
          apiDetailUrl: item.api_detail_url,
          resourceType: item.resource_type || resource,
          startYear: item.start_year,
          issueNumber: item.issue_number,
          deck: item.deck || item.description || item.brief_description
        }))
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "ComicVine request failed";
      if (message.includes("401")) {
        reply.status(401).send({ error: "ComicVine rejected the API key. Please re-save it." });
        return;
      }
      reply.status(502).send({ error: message });
    }
  });

  fastify.post("/import", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const body = importSchema.parse(request.body);
    const userId = request.user!.id;

    const job = await fastify.prisma.job.create({
      data: {
        userId,
        type: "COMICVINE_IMPORT",
        status: "PENDING",
        payload: {
          resource: body.resource,
          detailUrls: body.detailUrls,
          includeIssues: body.includeIssues ?? false
        }
      }
    });

    reply.send(job);
  });
}
