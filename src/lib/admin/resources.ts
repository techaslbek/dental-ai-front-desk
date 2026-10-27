import "server-only";
import { formatAmount, formatPriceRange } from "@/lib/format";
import type { Messages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/locales";
import type { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import { str, type FieldConfig } from "./fields";

// The three list-style knowledge sections share one set of pages
// (/dashboard/[slug]/[resource]); this module holds what differs.

export const RESOURCE_KEYS = ["services", "dentists", "faqs"] as const;
export type ResourceKey = (typeof RESOURCE_KEYS)[number];

export function isResourceKey(value: unknown): value is ResourceKey {
  return typeof value === "string" && (RESOURCE_KEYS as readonly string[]).includes(value);
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type ListItem = {
  id: string;
  primary: string;
  secondary?: string;
  meta?: string;
  isActive: boolean;
};

type ResourceDefinition = {
  titles: (t: Messages) => { list: string; create: string; edit: string };
  list: (supabase: Supabase, clinicId: string, t: Messages, locale: Locale) => Promise<ListItem[] | null>;
  // id = null builds an empty "create" form; returns null if the row isn't found.
  form: (supabase: Supabase, clinicId: string, id: string | null, t: Messages) => Promise<FieldConfig[] | null>;
};

// Prices are edited in the same "250 000" form the list shows; the schema
// accepts the spaces back.
const amount = (value: number | null | undefined) => (value === null || value === undefined ? "" : formatAmount(value));

// Show the current UI language first, the other one as a subtitle.
function byLocale(locale: Locale, uz: string | null, ru: string | null) {
  const [first, second] = locale === "ru" ? [ru, uz] : [uz, ru];
  return { primary: first || second || "—", secondary: first && second ? second : undefined };
}

const activeAndOrder = (t: Messages, row?: { is_active: boolean; sort_order: number }): FieldConfig[] => [
  { name: "is_active", label: t.common.isActive, type: "checkbox", defaultChecked: row?.is_active ?? true },
  {
    name: "sort_order",
    label: t.common.sortOrder,
    type: "number",
    inputMode: "numeric",
    defaultValue: str(row?.sort_order ?? 0),
    hint: t.common.sortOrderHint,
    width: "half",
  },
];

const bilingual = (
  t: Messages,
  base: string,
  label: string,
  type: "text" | "textarea",
  maxLength: number,
  row: Record<string, unknown> | undefined,
  required = false,
): FieldConfig[] => [
  {
    name: `${base}_uz`,
    label: `${label} (${t.common.inUzbek})`,
    type,
    maxLength,
    required,
    width: "half",
    lang: "uz",
    defaultValue: str(row?.[`${base}_uz`] as string | null),
  },
  {
    name: `${base}_ru`,
    label: `${label} (${t.common.inRussian})`,
    type,
    maxLength,
    required,
    width: "half",
    lang: "ru",
    defaultValue: str(row?.[`${base}_ru`] as string | null),
  },
];

// One typed query per table: the query builder's generics don't resolve over
// a union of table names.
const fetchOne = {
  services: async (supabase: Supabase, clinicId: string, id: string): Promise<Tables<"services"> | undefined> =>
    (await supabase.from("services").select("*").eq("clinic_id", clinicId).eq("id", id).maybeSingle()).data ?? undefined,
  dentists: async (supabase: Supabase, clinicId: string, id: string): Promise<Tables<"dentists"> | undefined> =>
    (await supabase.from("dentists").select("*").eq("clinic_id", clinicId).eq("id", id).maybeSingle()).data ?? undefined,
  faqs: async (supabase: Supabase, clinicId: string, id: string): Promise<Tables<"faqs"> | undefined> =>
    (await supabase.from("faqs").select("*").eq("clinic_id", clinicId).eq("id", id).maybeSingle()).data ?? undefined,
};

export const resources: Record<ResourceKey, ResourceDefinition> = {
  services: {
    titles: (t) => ({ list: t.services.title, create: t.services.new, edit: t.services.editTitle }),
    async list(supabase, clinicId, t, locale) {
      const { data, error } = await supabase
        .from("services")
        .select("id, name_uz, name_ru, price_min, price_max, currency, duration_minutes, is_active")
        .eq("clinic_id", clinicId)
        .order("sort_order")
        .order("name_uz");
      if (error) return null;
      return data.map((s) => ({
        id: s.id,
        ...byLocale(locale, s.name_uz, s.name_ru),
        meta: [
          formatPriceRange(s.price_min, s.price_max, s.currency, { ...t.common, ...t.services }),
          s.duration_minutes ? `${s.duration_minutes} ${t.common.minutes}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        isActive: s.is_active,
      }));
    },
    async form(supabase, clinicId, id, t) {
      const row = id ? await fetchOne.services(supabase, clinicId, id) : undefined;
      if (id && !row) return null;
      return [
        ...bilingual(t, "name", t.services.name, "text", 120, row, true),
        ...bilingual(t, "description", t.services.description, "textarea", 1000, row),
        {
          name: "price_min",
          label: t.services.priceMin,
          type: "text",
          inputMode: "numeric",
          width: "half",
          placeholder: "250 000",
          defaultValue: amount(row?.price_min),
        },
        {
          name: "price_max",
          label: t.services.priceMax,
          type: "text",
          inputMode: "numeric",
          width: "half",
          placeholder: "400 000",
          defaultValue: amount(row?.price_max),
          hint: t.services.priceHint,
        },
        {
          name: "duration_minutes",
          label: t.services.duration,
          type: "text",
          inputMode: "numeric",
          width: "half",
          defaultValue: str(row?.duration_minutes),
        },
        ...activeAndOrder(t, row),
      ];
    },
  },

  dentists: {
    titles: (t) => ({ list: t.dentists.title, create: t.dentists.new, edit: t.dentists.editTitle }),
    async list(supabase, clinicId, _t, locale) {
      const { data, error } = await supabase
        .from("dentists")
        .select("id, full_name, specialty_uz, specialty_ru, is_active")
        .eq("clinic_id", clinicId)
        .order("sort_order")
        .order("full_name");
      if (error) return null;
      return data.map((d) => ({
        id: d.id,
        primary: d.full_name,
        secondary: byLocale(locale, d.specialty_uz, d.specialty_ru).primary.replace(/^—$/, "") || undefined,
        isActive: d.is_active,
      }));
    },
    async form(supabase, clinicId, id, t) {
      const row = id ? await fetchOne.dentists(supabase, clinicId, id) : undefined;
      if (id && !row) return null;
      return [
        { name: "full_name", label: t.dentists.fullName, type: "text", required: true, maxLength: 120, defaultValue: str(row?.full_name) },
        ...bilingual(t, "specialty", t.dentists.specialty, "text", 120, row),
        ...bilingual(t, "bio", t.dentists.bio, "textarea", 1000, row),
        ...activeAndOrder(t, row),
      ];
    },
  },

  faqs: {
    titles: (t) => ({ list: t.faqs.title, create: t.faqs.new, edit: t.faqs.editTitle }),
    async list(supabase, clinicId, _t, locale) {
      const { data, error } = await supabase
        .from("faqs")
        .select("id, question_uz, question_ru, answer_uz, answer_ru, is_active")
        .eq("clinic_id", clinicId)
        .order("sort_order")
        .order("created_at");
      if (error) return null;
      return data.map((f) => {
        const question = byLocale(locale, f.question_uz, f.question_ru);
        const answer = byLocale(locale, f.answer_uz, f.answer_ru).primary;
        return {
          id: f.id,
          primary: question.primary,
          meta: answer.length > 140 ? `${answer.slice(0, 140)}…` : answer,
          isActive: f.is_active,
        };
      });
    },
    async form(supabase, clinicId, id, t) {
      const row = id ? await fetchOne.faqs(supabase, clinicId, id) : undefined;
      if (id && !row) return null;
      return [
        ...bilingual(t, "question", t.faqs.question, "text", 300, row),
        ...bilingual(t, "answer", t.faqs.answer, "textarea", 2000, row),
        ...activeAndOrder(t, row),
      ];
    },
  },
};
