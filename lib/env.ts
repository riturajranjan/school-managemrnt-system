import "server-only";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Server-side environment validation. NEVER expose these via NEXT_PUBLIC_.
// Parsed lazily so that tooling which imports server modules without a full
// environment (e.g. type-checking) doesn't crash at import time — the throw
// happens the first time a server module actually needs a value.
// ---------------------------------------------------------------------------

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  // Optional direct (non-pooled) connection for migrations on pooled providers.
  DIRECT_URL: z.string().min(1).optional(),
  SHADOW_DATABASE_URL: z.string().min(1).optional(),
  // Better Auth. Secret must be a real random value in every non-local env.
  BETTER_AUTH_SECRET: z.string().min(16, "BETTER_AUTH_SECRET must be at least 16 characters"),
  BETTER_AUTH_URL: z.string().url().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function getEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // Surface the missing/invalid keys without printing any values.
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid server environment. Fix these variables (see .env.example):\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
