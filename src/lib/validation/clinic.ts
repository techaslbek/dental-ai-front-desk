import { z } from "zod";
import type { ErrorKey } from "@/lib/i18n";
import { locales } from "@/lib/i18n/locales";

// Every error message is an ErrorKey; forms translate it for the current
// locale. Limits mirror the CHECK constraints in the database.

const err = (key: ErrorKey) => key;

// FormData gives string | null (null when a field is absent).
const formString = z.preprocess((v) => (typeof v === "string" ? v : ""), z.string());

const requiredText = (max: number) =>
  formString.pipe(z.string().trim().min(1, err("required")).max(max, err("tooLong")));

const optionalText = (max: number) =>
  formString.pipe(
    z
      .string()
      .trim()
      .max(max, err("tooLong"))
      .transform((v) => (v === "" ? null : v)),
  );

const optionalMatching = (pattern: RegExp, key: ErrorKey, normalize = (v: string) => v) =>
  formString.pipe(
    z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : normalize(v)))
      .refine((v) => v === null || pattern.test(v), err(key)),
  );

// Accepts "200 000", "200,000" or "200000"; empty means "not set".
const optionalInt = (min: number, max: number, rangeKey: ErrorKey = "invalidNumber") =>
  formString.pipe(
    z
      .string()
      .transform((v) => v.replace(/[\s,. ]/g, ""))
      .refine((v) => v === "" || /^\d+$/.test(v), err("invalidNumber"))
      .transform((v) => (v === "" ? null : Number(v)))
      .refine((v) => v === null || (v >= min && v <= max), err(rangeKey)),
  );

const checkbox = z.preprocess((v) => v === "on" || v === "true", z.boolean());

const sortOrder = formString.pipe(
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? "0" : v))
    .refine((v) => /^-?\d{1,6}$/.test(v), err("invalidNumber"))
    .transform(Number),
);

const localeField = z.preprocess(
  (v) => (typeof v === "string" ? v : "uz"),
  z.enum(locales, err("required")),
);

export const PHONE_PATTERN = /^\+?[0-9 ()-]{7,20}$/;
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/;

// ---------------------------------------------------------------------------

export const createClinicSchema = z.object({
  name: requiredText(120),
  slug: formString.pipe(
    z
      .string()
      .trim()
      .toLowerCase()
      .refine((v) => SLUG_PATTERN.test(v), err("invalidSlug")),
  ),
  default_locale: localeField,
});

export const profileSchema = z.object({
  name: requiredText(120),
  default_locale: localeField,
  phone: optionalMatching(PHONE_PATTERN, "invalidPhone"),
  telegram: optionalMatching(/^@[A-Za-z0-9_]{5,32}$/, "invalidTelegram", (v) => {
    const handle = v.replace(/^https?:\/\/t\.me\//i, "").replace(/^t\.me\//i, "");
    return handle.startsWith("@") ? handle : `@${handle}`;
  }),
  address_uz: optionalText(300),
  address_ru: optionalText(300),
  maps_url: optionalMatching(/^https:\/\/\S{4,500}$/, "invalidUrl"),
  about_uz: optionalText(2000),
  about_ru: optionalText(2000),
});

export const serviceSchema = z
  .object({
    name_uz: requiredText(120),
    name_ru: requiredText(120),
    description_uz: optionalText(1000),
    description_ru: optionalText(1000),
    price_min: optionalInt(0, 10_000_000_000),
    price_max: optionalInt(0, 10_000_000_000),
    duration_minutes: optionalInt(5, 600, "durationRange"),
    is_active: checkbox,
    sort_order: sortOrder,
  })
  .refine((s) => s.price_min === null || s.price_max === null || s.price_max >= s.price_min, {
    message: err("priceRange"),
    path: ["price_max"],
  });

export const dentistSchema = z.object({
  full_name: requiredText(120),
  specialty_uz: optionalText(120),
  specialty_ru: optionalText(120),
  bio_uz: optionalText(1000),
  bio_ru: optionalText(1000),
  is_active: checkbox,
  sort_order: sortOrder,
});

export const faqSchema = z
  .object({
    question_uz: optionalText(300),
    answer_uz: optionalText(2000),
    question_ru: optionalText(300),
    answer_ru: optionalText(2000),
    is_active: checkbox,
    sort_order: sortOrder,
  })
  .superRefine((f, ctx) => {
    for (const lang of ["uz", "ru"] as const) {
      const q = f[`question_${lang}`];
      const a = f[`answer_${lang}`];
      if (q && !a) ctx.addIssue({ code: "custom", message: err("faqAnswerMissing"), path: [`answer_${lang}`] });
      if (a && !q) ctx.addIssue({ code: "custom", message: err("faqQuestionMissing"), path: [`question_${lang}`] });
    }
    if (!(f.question_uz && f.answer_uz) && !(f.question_ru && f.answer_ru)) {
      ctx.addIssue({ code: "custom", message: err("faqNeedsPair"), path: [] });
    }
  });

// ---------------------------------------------------------------------------
// Opening hours: stored as {"mon": [{"open": "09:00", "close": "18:00"}], ...}.
// An empty list means closed that day.

export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Day = (typeof DAYS)[number];

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const intervalSchema = z
  .object({
    open: z.string().regex(TIME_PATTERN, err("invalidTime")),
    close: z.string().regex(TIME_PATTERN, err("invalidTime")),
  })
  // Only compare once both times are valid, so a bad time shows one error.
  .refine((i) => !TIME_PATTERN.test(i.open) || !TIME_PATTERN.test(i.close) || i.close > i.open, {
    message: err("timeOrder"),
    path: ["close"],
  });

export const openingHoursSchema = z.object(
  Object.fromEntries(DAYS.map((d) => [d, z.array(intervalSchema).max(3).default([])])) as Record<
    Day,
    z.ZodDefault<z.ZodArray<typeof intervalSchema>>
  >,
);

export type OpeningHours = z.infer<typeof openingHoursSchema>;

export const emptyOpeningHours = (): OpeningHours =>
  Object.fromEntries(DAYS.map((d) => [d, []])) as unknown as OpeningHours;

// Reads stored JSON; anything malformed is treated as "not set" rather than crashing.
export function readOpeningHours(value: unknown): OpeningHours {
  const parsed = openingHoursSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : emptyOpeningHours();
}

// Form fields per day: `${day}_closed` (checkbox), `${day}_open`, `${day}_close`.
export function parseHoursForm(formData: FormData) {
  const raw = Object.fromEntries(
    DAYS.map((d) => {
      const closed = formData.get(`${d}_closed`) === "on";
      const open = String(formData.get(`${d}_open`) ?? "").trim();
      const close = String(formData.get(`${d}_close`) ?? "").trim();
      return [d, closed ? [] : [{ open, close }]];
    }),
  );
  return openingHoursSchema.safeParse(raw);
}

// ---------------------------------------------------------------------------

export type FieldErrors = Record<string, ErrorKey>;

// First error per field, keyed by the form field name. Hours errors arrive as
// path ["mon", 0, "close"] and map to "mon_close".
export function toFieldErrors(error: z.ZodError): { fieldErrors: FieldErrors; formError?: ErrorKey } {
  const fieldErrors: FieldErrors = {};
  let formError: ErrorKey | undefined;
  for (const issue of error.issues) {
    const key = issue.path.filter((p) => typeof p === "string").join("_");
    const message = issue.message as ErrorKey;
    if (!key) {
      formError ??= message;
    } else {
      fieldErrors[key] ??= message;
    }
  }
  return { fieldErrors, formError };
}
