import fp from "fastify-plugin";
import { PrismaClient } from "@prisma/client";

export default fp(async (fastify) => {
  const prisma = new PrismaClient();
  let attempts = 0;
  while (true) {
    try {
      await prisma.$connect();
      break;
    } catch (error) {
      attempts += 1;
      if (attempts >= 5) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  fastify.decorate("prisma", prisma);

  fastify.addHook("onClose", async (app) => {
    await app.prisma.$disconnect();
  });
});
