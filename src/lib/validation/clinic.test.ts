import { describe, expect, it } from "vitest";
import {
  createClinicSchema,
  faqSchema,
  parseHoursForm,
  profileSchema,
  readOpeningHours,
  serviceSchema,
  toFieldErrors,
} from "./clinic";

const form = (entries: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
};

const errorsOf = (result: { success: boolean; error?: unknown }) =>
  result.success ? {} : toFieldErrors(result.error as never).fieldErrors;

describe("createClinicSchema", () => {
  it("lowercases and trims the slug", () => {
    const r = createClinicSchema.parse({ name: " Smile ", slug: " Smile-Dental ", default_locale: "ru" });
    expect(r).toEqual({ name: "Smile", slug: "smile-dental", default_locale: "ru" });
  });

  it("rejects slugs the database would reject", () => {
    for (const slug of ["ab", "-smile", "smile-", "smile dental", "смайл"]) {
      const r = createClinicSchema.safeParse({ name: "x", slug, default_locale: "uz" });
      expect(errorsOf(r).slug, slug).toBe("invalidSlug");
    }
  });
});

describe("profileSchema", () => {
  const base = { name: "Clinic", default_locale: "uz" };

  it("turns empty optional fields into null", () => {
    const r = profileSchema.parse({ ...base, phone: "", address_uz: "  " });
    expect(r.phone).toBeNull();
    expect(r.address_uz).toBeNull();
    expect(r.telegram).toBeNull();
  });

  it("normalises Telegram handles and links", () => {
    expect(profileSchema.parse({ ...base, telegram: "smile_clinic" }).telegram).toBe("@smile_clinic");
    expect(profileSchema.parse({ ...base, telegram: "https://t.me/smile_clinic" }).telegram).toBe("@smile_clinic");
  });

  it("validates phone and map link", () => {
    const r = profileSchema.safeParse({ ...base, phone: "call me", maps_url: "http://maps.example" });
    expect(errorsOf(r)).toMatchObject({ phone: "invalidPhone", maps_url: "invalidUrl" });
    expect(profileSchema.parse({ ...base, phone: "+998 90 123-45-67" }).phone).toBe("+998 90 123-45-67");
  });
});

describe("serviceSchema", () => {
  const base = { name_uz: "Plomba", name_ru: "Пломба" };

  it("parses grouped prices and the active checkbox", () => {
    const r = serviceSchema.parse({ ...base, price_min: "250 000", price_max: "400,000", is_active: "on" });
    expect(r).toMatchObject({ price_min: 250000, price_max: 400000, is_active: true, sort_order: 0 });
    expect(serviceSchema.parse(base).is_active).toBe(false);
  });

  it("rejects an inverted price range on the max field", () => {
    const r = serviceSchema.safeParse({ ...base, price_min: "500000", price_max: "100000" });
    expect(errorsOf(r)).toEqual({ price_max: "priceRange" });
  });

  it("rejects non-numeric prices and out-of-range durations", () => {
    const r = serviceSchema.safeParse({ ...base, price_min: "free", duration_minutes: "2" });
    expect(errorsOf(r)).toMatchObject({ price_min: "invalidNumber", duration_minutes: "durationRange" });
  });

  it("requires both language names", () => {
    expect(errorsOf(serviceSchema.safeParse({ name_uz: "Plomba" }))).toEqual({ name_ru: "required" });
  });
});

describe("faqSchema", () => {
  it("accepts one complete language", () => {
    expect(faqSchema.safeParse({ question_ru: "Есть парковка?", answer_ru: "Да" }).success).toBe(true);
  });

  it("requires a question and answer in at least one language", () => {
    const r = faqSchema.safeParse({});
    expect(r.success).toBe(false);
    expect(toFieldErrors(r.error!).formError).toBe("faqNeedsPair");
  });

  it("flags a question without an answer", () => {
    const r = faqSchema.safeParse({ question_uz: "Parkovka bormi?", question_ru: "Парковка?", answer_ru: "Да" });
    expect(errorsOf(r)).toEqual({ answer_uz: "faqAnswerMissing" });
  });
});

describe("opening hours", () => {
  it("parses a week with closed days", () => {
    const fd = form({ mon_open: "09:00", mon_close: "18:00", sun_closed: "on" });
    for (const d of ["tue", "wed", "thu", "fri", "sat"]) {
      fd.set(`${d}_open`, "10:00");
      fd.set(`${d}_close`, "17:30");
    }
    const r = parseHoursForm(fd);
    expect(r.success).toBe(true);
    expect(r.data!.mon).toEqual([{ open: "09:00", close: "18:00" }]);
    expect(r.data!.sun).toEqual([]);
  });

  it("maps errors to the day's form field", () => {
    const fd = form({ mon_open: "18:00", mon_close: "09:00", tue_open: "25:00", tue_close: "10:00" });
    for (const d of ["wed", "thu", "fri", "sat", "sun"]) fd.set(`${d}_closed`, "on");
    const r = parseHoursForm(fd);
    expect(errorsOf(r)).toEqual({ mon_close: "timeOrder", tue_open: "invalidTime" });
  });

  it("treats malformed stored JSON as not set", () => {
    expect(readOpeningHours({ mon: "always" }).mon).toEqual([]);
    expect(readOpeningHours(null).fri).toEqual([]);
    expect(readOpeningHours({ fri: [{ open: "08:00", close: "12:00" }] }).fri).toHaveLength(1);
  });
});
