import type { FastifyReply, FastifyRequest } from "fastify";
import { PrismaClient } from "@prisma/client";
import "@fastify/jwt";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { id: string; email: string };
    user: { id: string; email: string };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
