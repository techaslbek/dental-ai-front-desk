import "server-only";
import { z } from "zod";

// Server-only secrets. Parsed lazily so pages that don't need them (and the
// build) work without them; the chat endpoint fails closed if they're missing.
const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(20, "SUPABASE_SECRET_KEY is missing"),
  OPENAI_API_KEY: z.string().min(20, "OPENAI_API_KEY is missing"),
  OPENAI_MODEL: z.string().min(1).default("gpt-5.4-mini"),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const result = serverSchema.safeParse({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL || undefined,
  });
  if (!result.success) {
    // Names only; never echo secret values.
    const names = result.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Server environment is not configured: ${names}`);
  }
  cached = result.data;
  return cached;
}
