import { z } from "zod";

// Values that are safe to ship to the browser. Anything prefixed NEXT_PUBLIC_
// is inlined into client bundles, so secrets must never appear here.
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url().startsWith("https://"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .startsWith("sb_publishable_", "Use the publishable key, never the secret/service key"),
});

export type PublicEnv = z.infer<typeof publicSchema>;

export function parsePublicEnv(source: Record<string, string | undefined>): PublicEnv {
  const result = publicSchema.safeParse(source);
  if (!result.success) {
    // Report which variables are wrong without echoing their values.
    const names = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid or missing public environment variables: ${names}`);
  }
  return result.data;
}

// NEXT_PUBLIC_* must be referenced literally for Next.js to inline them.
export const publicEnv = parsePublicEnv({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});
