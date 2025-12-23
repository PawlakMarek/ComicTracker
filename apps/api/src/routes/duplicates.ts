import { FastifyInstance } from "fastify";

const normalize = (value: string | null | undefined) => (value || "").trim().toLowerCase();

export default async function duplicatesRoutes(fastify: FastifyInstance) {
  fastify.get("/", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { entity } = request.query as { entity?: string };
    const userId = request.user!.id;

    switch (entity) {
      case "publishers": {
        const items = await fastify.prisma.publisher.findMany({ where: { userId } });
        const groups = new Map<string, typeof items>();
        items.forEach((item) => {
          const key = normalize(item.name);
          const group = groups.get(key) || [];
          group.push(item);
          groups.set(key, group);
        });
        reply.send({
          entity,
          groups: Array.from(groups.entries())
            .filter(([, group]) => group.length > 1)
            .map(([key, group]) => ({
              key,
              items: group.map((item) => ({ id: item.id, label: item.name }))
            }))
        });
        return;
      }
      case "series": {
        const items = await fastify.prisma.series.findMany({
          where: { userId },
          include: { publisher: true }
        });
        const groups = new Map<string, typeof items>();
        items.forEach((item) => {
          const key = `${item.publisherId}:${normalize(item.name)}`;
          const group = groups.get(key) || [];
          group.push(item);
          groups.set(key, group);
        });
        reply.send({
          entity,
          groups: Array.from(groups.entries())
            .filter(([, group]) => group.length > 1)
            .map(([key, group]) => ({
              key,
              items: group.map((item) => ({
                id: item.id,
                label: `${item.name} (${item.publisher?.name || ""})`
              }))
            }))
        });
        return;
      }
      case "characters": {
        const items = await fastify.prisma.characterOrTeam.findMany({ where: { userId } });
        const groups = new Map<string, typeof items>();
        items.forEach((item) => {
          const key = `${item.type}:${normalize(item.name)}`;
          const group = groups.get(key) || [];
          group.push(item);
          groups.set(key, group);
        });
        reply.send({
          entity,
          groups: Array.from(groups.entries())
            .filter(([, group]) => group.length > 1)
            .map(([key, group]) => ({
              key,
              items: group.map((item) => ({ id: item.id, label: `${item.name} (${item.type})` }))
            }))
        });
        return;
      }
      case "events": {
        const items = await fastify.prisma.event.findMany({ where: { userId } });
        const groups = new Map<string, typeof items>();
        items.forEach((item) => {
          const key = normalize(item.name);
          const group = groups.get(key) || [];
          group.push(item);
          groups.set(key, group);
        });
        reply.send({
          entity,
          groups: Array.from(groups.entries())
            .filter(([, group]) => group.length > 1)
            .map(([key, group]) => ({
              key,
              items: group.map((item) => ({ id: item.id, label: item.name }))
            }))
        });
        return;
      }
      case "story-blocks": {
        const items = await fastify.prisma.storyBlock.findMany({ where: { userId } });
        const groups = new Map<string, typeof items>();
        items.forEach((item) => {
          const key = normalize(item.name);
          const group = groups.get(key) || [];
          group.push(item);
          groups.set(key, group);
        });
        reply.send({
          entity,
          groups: Array.from(groups.entries())
            .filter(([, group]) => group.length > 1)
            .map(([key, group]) => ({
              key,
              items: group.map((item) => ({ id: item.id, label: item.name }))
            }))
        });
        return;
      }
      case "issues": {
        const items = await fastify.prisma.issue.findMany({
          where: { userId },
          include: { series: true }
        });
        const groups = new Map<string, typeof items>();
        items.forEach((item) => {
          const key = `${item.seriesId}:${normalize(item.issueNumber)}`;
          const group = groups.get(key) || [];
          group.push(item);
          groups.set(key, group);
        });
        reply.send({
          entity,
          groups: Array.from(groups.entries())
            .filter(([, group]) => group.length > 1)
            .map(([key, group]) => ({
              key,
              items: group.map((item) => ({
                id: item.id,
                label: `${item.series?.name || ""} #${item.issueNumber}`
              }))
            }))
        });
        return;
      }
      default:
        reply.status(400).send({ error: "Unsupported entity" });
    }
  });
}
