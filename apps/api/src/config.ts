import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  COOKIE_SECRET: z.string().min(16),
  API_PORT: z.string().default("3001"),
  WEB_ORIGIN: z.string().default("http://localhost:3000"),
  COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: z.string().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development")
});

export const env = envSchema.parse(process.env);

export const isProd = env.NODE_ENV === "production";

export const webOrigins = env.WEB_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const secureOverride = env.COOKIE_SECURE?.toLowerCase();
export const cookieSecure =
  secureOverride === "true" || secureOverride === "false"
    ? secureOverride === "true"
    : isProd || env.COOKIE_SAMESITE === "none";
