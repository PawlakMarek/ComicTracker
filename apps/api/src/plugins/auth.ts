import fp from "fastify-plugin";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import { env } from "../config";

export const authCookieName = "ct_session";

export default fp(async (fastify) => {
  await fastify.register(cookie, {
    secret: env.COOKIE_SECRET
  });

  await fastify.register(jwt, {
    secret: env.JWT_SECRET,
    cookie: {
      cookieName: authCookieName,
      signed: true
    }
  });

  fastify.decorate("requireAuth", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (error) {
      reply.status(401).send({ error: "Unauthorized" });
      return;
    }

    const payload = request.user as { id: string; email: string };
    request.user = { id: payload.id, email: payload.email };
  });
});
