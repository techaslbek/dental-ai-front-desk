"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getClinicContext } from "@/lib/admin/clinic-context";
import { formValues, type FormState } from "@/lib/admin/form-state";
import { isResourceKey } from "@/lib/admin/resources";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n/locales";
import type { ErrorKey } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import {
  createClinicSchema,
  dentistSchema,
  faqSchema,
  parseHoursForm,
  profileSchema,
  serviceSchema,
  toFieldErrors,
} from "@/lib/validation/clinic";

// Every action here is a public endpoint: arguments (including bound ones)
// are re-validated, and every write runs as the signed-in user under RLS.

const failure = (formData: FormData, formError: ErrorKey, fieldErrors = {}): FormState => ({
  status: "error",
  formError,
  fieldErrors,
  values: formValues(formData),
});

const invalid = (formData: FormData, error: z.ZodError): FormState => ({
  status: "error",
  ...toFieldErrors(error),
  values: formValues(formData),
});

const uuid = z.uuid();

export async function setLocale(formData: FormData) {
  const locale = formData.get("locale");
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
  });
  refresh();
}

export async function createClinic(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = createClinicSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(formData, parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_clinic", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_default_locale: parsed.data.default_locale,
  });

  if (error) {
    if (error.code === "23505") return failure(formData, "slugTaken", { slug: "slugTaken" });
    if (error.code === "23514") return failure(formData, "invalidSlug", { slug: "invalidSlug" });
    if (error.hint === "clinic_limit") return failure(formData, "clinicLimit");
    if (error.code === "42501") return failure(formData, "forbidden");
    return failure(formData, "generic");
  }

  redirect(`/dashboard/${parsed.data.slug}`);
}

export async function saveProfile(slug: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const clinic = await getClinicContext(slug);
  if (!clinic) return failure(formData, "notFound");

  const input = Object.fromEntries(formData);
  // Name and default language are owner-only; staff see them read-only and
  // the disabled inputs are not submitted.
  if (clinic.role !== "owner") {
    input.name = clinic.name;
    input.default_locale = clinic.defaultLocale;
  }
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return invalid(formData, parsed.error);

  const { name, default_locale, ...profile } = parsed.data;
  const supabase = await createClient();

  if (clinic.role === "owner" && (name !== clinic.name || default_locale !== clinic.defaultLocale)) {
    const { data, error } = await supabase
      .from("clinics")
      .update({ name, default_locale })
      .eq("id", clinic.id)
      .select("id");
    if (error || data.length === 0) return failure(formData, "generic");
  }

  const { error } = await supabase
    .from("clinic_profiles")
    .upsert({ clinic_id: clinic.id, ...profile }, { onConflict: "clinic_id" });
  if (error) return failure(formData, "generic");

  refresh();
  return { status: "success" };
}

export async function saveHours(slug: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const clinic = await getClinicContext(slug);
  if (!clinic) return failure(formData, "notFound");

  const parsed = parseHoursForm(formData);
  if (!parsed.success) return invalid(formData, parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("clinic_profiles")
    .upsert({ clinic_id: clinic.id, opening_hours: parsed.data }, { onConflict: "clinic_id" });
  if (error) return failure(formData, "generic");

  refresh();
  return { status: "success" };
}

export async function saveResource(
  resource: string,
  slug: string,
  id: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isResourceKey(resource) || (id !== null && !uuid.safeParse(id).success)) {
    return failure(formData, "notFound");
  }
  const clinic = await getClinicContext(slug);
  if (!clinic) return failure(formData, "notFound");

  const supabase = await createClient();
  const input = Object.fromEntries(formData);
  let result: { data: { id: string }[] | null; error: unknown };

  // One branch per table keeps the column types checked end to end.
  switch (resource) {
    case "services": {
      const parsed = serviceSchema.safeParse(input);
      if (!parsed.success) return invalid(formData, parsed.error);
      result = id
        ? await supabase.from("services").update(parsed.data).eq("id", id).eq("clinic_id", clinic.id).select("id")
        : await supabase.from("services").insert({ ...parsed.data, clinic_id: clinic.id }).select("id");
      break;
    }
    case "dentists": {
      const parsed = dentistSchema.safeParse(input);
      if (!parsed.success) return invalid(formData, parsed.error);
      result = id
        ? await supabase.from("dentists").update(parsed.data).eq("id", id).eq("clinic_id", clinic.id).select("id")
        : await supabase.from("dentists").insert({ ...parsed.data, clinic_id: clinic.id }).select("id");
      break;
    }
    case "faqs": {
      const parsed = faqSchema.safeParse(input);
      if (!parsed.success) return invalid(formData, parsed.error);
      result = id
        ? await supabase.from("faqs").update(parsed.data).eq("id", id).eq("clinic_id", clinic.id).select("id")
        : await supabase.from("faqs").insert({ ...parsed.data, clinic_id: clinic.id }).select("id");
      break;
    }
  }

  if (result.error) return failure(formData, "generic");
  if (!result.data || result.data.length === 0) return failure(formData, "notFound");

  redirect(`/dashboard/${clinic.slug}/${resource}`);
}

export async function deleteResource(
  resource: string,
  slug: string,
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isResourceKey(resource) || !uuid.safeParse(id).success) return failure(formData, "notFound");
  const clinic = await getClinicContext(slug);
  if (!clinic) return failure(formData, "notFound");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from(resource)
    .delete()
    .eq("id", id)
    .eq("clinic_id", clinic.id)
    .select("id");
  if (error) return failure(formData, "generic");
  if (data.length === 0) return failure(formData, "notFound");

  refresh();
  return { status: "success" };
}
