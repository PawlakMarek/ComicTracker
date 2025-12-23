import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { ZodError } from "zod";
import { isProd, webOrigins } from "./config";
import prismaPlugin from "./plugins/prisma";
import authPlugin from "./plugins/auth";
import authRoutes from "./routes/auth";
import publisherRoutes from "./routes/publishers";
import seriesRoutes from "./routes/series";
import characterRoutes from "./routes/characters";
import eventRoutes from "./routes/events";
import storyBlockRoutes from "./routes/story-blocks";
import issueRoutes from "./routes/issues";
import sessionRoutes from "./routes/sessions";
import dashboardRoutes from "./routes/dashboard";
import readingOrderRoutes from "./routes/reading-orders";
import importRoutes from "./routes/import";
import exportRoutes from "./routes/export";
import settingsRoutes from "./routes/settings";
import jobsRoutes from "./routes/jobs";
import comicVineRoutes from "./routes/comicvine";
import duplicatesRoutes from "./routes/duplicates";
import mergeRoutes from "./routes/merge";
import statsRoutes from "./routes/stats";

export async function buildApp() {
  const fastify = Fastify({
    logger: !isProd ? true : { level: "info" }
  });

  await fastify.register(cors, {
    origin: webOrigins,
    credentials: true
  });

  await fastify.register(multipart, {
    limits: {
      fileSize: 25 * 1024 * 1024
    }
  });

  await fastify.register(prismaPlugin);
  await fastify.register(authPlugin);

  fastify.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      reply.status(400).send({ error: "Validation failed", details: error.errors });
      return;
    }

    fastify.log.error(error);
    reply.status(500).send({ error: "Internal server error" });
  });

  fastify.get("/api/health", async () => ({ status: "ok" }));

  await fastify.register(authRoutes, { prefix: "/api/auth" });
  await fastify.register(publisherRoutes, { prefix: "/api/publishers" });
  await fastify.register(seriesRoutes, { prefix: "/api/series" });
  await fastify.register(characterRoutes, { prefix: "/api/characters" });
  await fastify.register(eventRoutes, { prefix: "/api/events" });
  await fastify.register(storyBlockRoutes, { prefix: "/api/story-blocks" });
  await fastify.register(readingOrderRoutes, { prefix: "/api/reading-orders" });
  await fastify.register(issueRoutes, { prefix: "/api/issues" });
  await fastify.register(sessionRoutes, { prefix: "/api/sessions" });
  await fastify.register(dashboardRoutes, { prefix: "/api/dashboard" });
  await fastify.register(importRoutes, { prefix: "/api/import" });
  await fastify.register(exportRoutes, { prefix: "/api/export" });
  await fastify.register(settingsRoutes, { prefix: "/api/settings" });
  await fastify.register(jobsRoutes, { prefix: "/api/jobs" });
  await fastify.register(comicVineRoutes, { prefix: "/api/comicvine" });
  await fastify.register(duplicatesRoutes, { prefix: "/api/duplicates" });
  await fastify.register(mergeRoutes, { prefix: "/api/merge" });
  await fastify.register(statsRoutes, { prefix: "/api/stats" });

  return fastify;
}
