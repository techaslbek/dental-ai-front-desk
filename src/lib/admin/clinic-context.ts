import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/database.types";

export type ClinicContext = {
  id: string;
  name: string;
  slug: string;
  defaultLocale: string;
  role: Enums<"member_role">;
};

// The clinic behind a URL slug, as seen by the signed-in user. Returns null
// when signed out, when the clinic doesn't exist, or when the user isn't a
// member: RLS makes those cases indistinguishable, which is intended.
// Cached per request so layout, page and actions share one lookup.
export const getClinicContext = cache(async (slug: string): Promise<ClinicContext | null> => {
  if (typeof slug !== "string" || slug.length > 48) return null;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return null;

  const { data } = await supabase
    .from("clinics")
    .select("id, name, slug, default_locale, clinic_members!inner(role)")
    .eq("slug", slug)
    .eq("clinic_members.user_id", userId)
    .maybeSingle();

  const role = data?.clinic_members[0]?.role;
  if (!data || !role) return null;

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    defaultLocale: data.default_locale,
    role,
  };
});
