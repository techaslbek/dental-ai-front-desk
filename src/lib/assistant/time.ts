import { DAYS, type Day, type OpeningHours } from "@/lib/validation/clinic";

// Clinics are in Uzbekistan (UTC+5, no daylight saving). Everything the
// assistant says about "today" or "open now" is computed here, not by the model.
export const CLINIC_TIME_ZONE = "Asia/Tashkent";

export type ClinicClock = {
  date: string; // YYYY-MM-DD
  day: Day;
  time: string; // HH:MM
};

export function clinicClock(now: Date): ClinicClock {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: CLINIC_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const day = parts.weekday.toLowerCase().slice(0, 3) as Day;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    day: DAYS.includes(day) ? day : "mon",
    time: `${parts.hour}:${parts.minute}`,
  };
}

export function isOpenAt(hours: OpeningHours, clock: ClinicClock): boolean {
  return hours[clock.day].some((i) => clock.time >= i.open && clock.time < i.close);
}

// "2026-10-28" + n days, in calendar terms (no time zone drift).
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function dayOf(date: string): Day {
  return DAYS[(new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7];
}
