import { FastifyInstance } from "fastify";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { authCookieName } from "../plugins/auth";
import { cookieSecure, env } from "../config";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post("/register", async (request, reply) => {
    const body = credentialsSchema.parse(request.body);

    const existing = await fastify.prisma.user.findUnique({
      where: { email: body.email }
    });

    if (existing) {
      reply.status(409).send({ error: "Email already registered" });
      return;
    }

    const passwordHash = await bcrypt.hash(body.password, 12);

    const user = await fastify.prisma.user.create({
      data: {
        email: body.email,
        passwordHash
      }
    });

    const token = fastify.jwt.sign({ id: user.id, email: user.email });

    reply.setCookie(authCookieName, token, {
      path: "/",
      httpOnly: true,
      sameSite: env.COOKIE_SAMESITE,
      secure: cookieSecure,
      ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
      signed: true
    });

    reply.send({ id: user.id, email: user.email });
  });

  fastify.post("/login", async (request, reply) => {
    const body = credentialsSchema.parse(request.body);

    const user = await fastify.prisma.user.findUnique({
      where: { email: body.email }
    });

    if (!user) {
      reply.status(401).send({ error: "Invalid credentials" });
      return;
    }

    const isValid = await bcrypt.compare(body.password, user.passwordHash);

    if (!isValid) {
      reply.status(401).send({ error: "Invalid credentials" });
      return;
    }

    const token = fastify.jwt.sign({ id: user.id, email: user.email });

    reply.setCookie(authCookieName, token, {
      path: "/",
      httpOnly: true,
      sameSite: env.COOKIE_SAMESITE,
      secure: cookieSecure,
      ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
      signed: true
    });

    reply.send({ id: user.id, email: user.email });
  });

  fastify.post("/logout", { preHandler: fastify.requireAuth }, async (_request, reply) => {
    reply.clearCookie(authCookieName, { path: "/", signed: true });
    reply.send({ ok: true });
  });

  fastify.get("/me", { preHandler: fastify.requireAuth }, async (request, reply) => {
    reply.send({ id: request.user?.id, email: request.user?.email });
  });
}
