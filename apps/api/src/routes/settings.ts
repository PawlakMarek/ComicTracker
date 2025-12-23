import { FastifyInstance } from "fastify";
import { z } from "zod";

const settingsSchema = z.object({
  comicVineApiKey: z.string().min(1).optional().nullable()
});

export default async function settingsRoutes(fastify: FastifyInstance) {
  fastify.get("/", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const userId = request.user!.id;
    const settings = await fastify.prisma.userSetting.findUnique({ where: { userId } });
    reply.send({ comicVineApiKey: settings?.comicVineApiKey ?? null });
  });

  fastify.put("/", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const userId = request.user!.id;
    const body = settingsSchema.parse(request.body);
    const normalizedKey = body.comicVineApiKey?.trim() || null;

    const settings = await fastify.prisma.userSetting.upsert({
      where: { userId },
      update: { comicVineApiKey: normalizedKey },
      create: { userId, comicVineApiKey: normalizedKey }
    });

    reply.send({ comicVineApiKey: settings.comicVineApiKey });
  });
}
