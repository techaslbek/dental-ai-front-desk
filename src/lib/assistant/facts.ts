import type { SupabaseClient } from "@supabase/supabase-js";
import { formatAmount } from "@/lib/format";
import type { Database } from "@/lib/supabase/database.types";
import { DAYS, readOpeningHours, type OpeningHours } from "@/lib/validation/clinic";

// Everything the assistant may say about a clinic comes from this object,
// built from staff-approved data (active items only).

export type ClinicFacts = {
  clinicId: string;
  name: string;
  defaultLocale: "uz" | "ru";
  phone: string | null;
  telegram: string | null;
  addressUz: string | null;
  addressRu: string | null;
  mapsUrl: string | null;
  aboutUz: string | null;
  aboutRu: string | null;
  hours: OpeningHours;
  hoursSet: boolean;
  services: {
    ref: string; // "S1" — short reference the model uses in tool calls
    id: string;
    nameUz: string;
    nameRu: string;
    descriptionUz: string | null;
    descriptionRu: string | null;
    priceMin: number | null;
    priceMax: number | null;
    currency: string;
    durationMinutes: number | null;
  }[];
  dentists: {
    ref: string; // "D1"
    id: string;
    fullName: string;
    specialtyUz: string | null;
    specialtyRu: string | null;
    bioUz: string | null;
    bioRu: string | null;
  }[];
  faqs: { questionUz: string | null; answerUz: string | null; questionRu: string | null; answerRu: string | null }[];
};

type Admin = SupabaseClient<Database>;

export async function loadClinicFacts(admin: Admin, clinic: { id: string; name: string; default_locale: string }) {
  const [profile, services, dentists, faqs] = await Promise.all([
    admin.from("clinic_profiles").select("*").eq("clinic_id", clinic.id).maybeSingle(),
    admin
      .from("services")
      .select("id, name_uz, name_ru, description_uz, description_ru, price_min, price_max, currency, duration_minutes")
      .eq("clinic_id", clinic.id)
      .eq("is_active", true)
      .order("sort_order")
      .order("name_uz")
      .limit(100),
    admin
      .from("dentists")
      .select("id, full_name, specialty_uz, specialty_ru, bio_uz, bio_ru")
      .eq("clinic_id", clinic.id)
      .eq("is_active", true)
      .order("sort_order")
      .order("full_name")
      .limit(50),
    admin
      .from("faqs")
      .select("question_uz, answer_uz, question_ru, answer_ru")
      .eq("clinic_id", clinic.id)
      .eq("is_active", true)
      .order("sort_order")
      .order("created_at")
      .limit(50),
  ]);

  const error = profile.error ?? services.error ?? dentists.error ?? faqs.error;
  if (error) throw new Error(`Could not load clinic facts: ${error.message}`);

  const p = profile.data;
  const hours = readOpeningHours(p?.opening_hours);

  const facts: ClinicFacts = {
    clinicId: clinic.id,
    name: clinic.name,
    defaultLocale: clinic.default_locale === "ru" ? "ru" : "uz",
    phone: p?.phone ?? null,
    telegram: p?.telegram ?? null,
    addressUz: p?.address_uz ?? null,
    addressRu: p?.address_ru ?? null,
    mapsUrl: p?.maps_url ?? null,
    aboutUz: p?.about_uz ?? null,
    aboutRu: p?.about_ru ?? null,
    hours,
    hoursSet: Object.values(hours).some((d) => d.length > 0),
    services: (services.data ?? []).map((s, i) => ({
      ref: `S${i + 1}`,
      id: s.id,
      nameUz: s.name_uz,
      nameRu: s.name_ru,
      descriptionUz: s.description_uz,
      descriptionRu: s.description_ru,
      priceMin: s.price_min,
      priceMax: s.price_max,
      currency: s.currency,
      durationMinutes: s.duration_minutes,
    })),
    dentists: (dentists.data ?? []).map((d, i) => ({
      ref: `D${i + 1}`,
      id: d.id,
      fullName: d.full_name,
      specialtyUz: d.specialty_uz,
      specialtyRu: d.specialty_ru,
      bioUz: d.bio_uz,
      bioRu: d.bio_ru,
    })),
    faqs: (faqs.data ?? []).map((f) => ({
      questionUz: f.question_uz,
      answerUz: f.answer_uz,
      questionRu: f.question_ru,
      answerRu: f.answer_ru,
    })),
  };
  return facts;
}

function price(s: ClinicFacts["services"][number]): string {
  const unit = s.currency;
  if (s.priceMin === null && s.priceMax === null) return "price not published (staff will tell the patient)";
  if (s.priceMin !== null && (s.priceMax === null || s.priceMax === s.priceMin)) return `${formatAmount(s.priceMin)} ${unit}`;
  if (s.priceMin === null) return `up to ${formatAmount(s.priceMax!)} ${unit}`;
  return `from ${formatAmount(s.priceMin)} to ${formatAmount(s.priceMax!)} ${unit}`;
}

const line = (label: string, value: string | null) => (value ? `${label}: ${value}` : null);

// Plain-text facts block for the model. Uzbek and Russian values are both
// included so the assistant can answer in either language.
export function renderFacts(f: ClinicFacts): string {
  const out: (string | null)[] = [
    `Clinic name: ${f.name}`,
    line("Phone", f.phone),
    line("Telegram", f.telegram),
    line("Address (uz)", f.addressUz),
    line("Address (ru)", f.addressRu),
    line("Map link", f.mapsUrl),
    line("About (uz)", f.aboutUz),
    line("About (ru)", f.aboutRu),
    "",
    "Opening hours (Tashkent time):",
    ...(f.hoursSet
      ? DAYS.map((d) => {
          const intervals = f.hours[d];
          return `- ${d}: ${intervals.length ? intervals.map((i) => `${i.open}-${i.close}`).join(", ") : "closed"}`;
        })
      : ["- not provided"]),
    "",
    "Services:",
    ...(f.services.length
      ? f.services.map((s) =>
          [
            `- [${s.ref}] uz: ${s.nameUz} | ru: ${s.nameRu} | price: ${price(s)}`,
            s.durationMinutes ? ` | duration: ${s.durationMinutes} min` : "",
            s.descriptionUz ? `\n  description (uz): ${s.descriptionUz}` : "",
            s.descriptionRu ? `\n  description (ru): ${s.descriptionRu}` : "",
          ].join(""),
        )
      : ["- none listed"]),
    "",
    "Dentists:",
    ...(f.dentists.length
      ? f.dentists.map((d) =>
          [
            `- [${d.ref}] ${d.fullName}`,
            d.specialtyUz ? ` | specialty (uz): ${d.specialtyUz}` : "",
            d.specialtyRu ? ` | specialty (ru): ${d.specialtyRu}` : "",
            d.bioUz ? `\n  about (uz): ${d.bioUz}` : "",
            d.bioRu ? `\n  about (ru): ${d.bioRu}` : "",
          ].join(""),
        )
      : ["- none listed"]),
    "",
    "Frequently asked questions:",
    ...(f.faqs.length
      ? f.faqs.flatMap((q) => [
          q.questionUz && q.answerUz ? `- Q (uz): ${q.questionUz}\n  A (uz): ${q.answerUz}` : null,
          q.questionRu && q.answerRu ? `- Q (ru): ${q.questionRu}\n  A (ru): ${q.answerRu}` : null,
        ])
      : ["- none"]),
  ];
  return out.filter((l) => l !== null).join("\n");
}
