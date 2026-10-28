import { tool } from "ai";
import { z } from "zod";
import { PHONE_PATTERN } from "@/lib/validation/clinic";
import type { ClinicFacts } from "./facts";
import { addDays, dayOf, type ClinicClock } from "./time";

// Side effects are injected so the same tools run against the database in the
// API route and against an in-memory recorder in tests and evaluations.
export type AppointmentRequestInput = {
  patientName: string;
  patientPhone: string;
  serviceId: string | null;
  dentistId: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  notes: string | null;
};

export type AssistantActions = {
  createAppointmentRequest: (input: AppointmentRequestInput) => Promise<{ id: string }>;
  requestHandoff: (reason: string) => Promise<void>;
};

export const MAX_REQUESTS_PER_CONVERSATION = 2;
export const MAX_DAYS_AHEAD = 60;

type ToolError = { ok: false; error: string; message: string };
const fail = (error: string, message: string): ToolError => ({ ok: false, error, message });

export function createAssistantTools(opts: {
  facts: ClinicFacts;
  clock: ClinicClock;
  actions: AssistantActions;
  requestsSoFar: number;
}) {
  const { facts, clock, actions } = opts;
  let requestsSoFar = opts.requestsSoFar;

  return {
    create_appointment_request: tool({
      description:
        "Send the patient's appointment REQUEST to clinic staff. Call only after the patient has confirmed the details. " +
        "This does not book or confirm a time; staff will contact the patient.",
      inputSchema: z.object({
        patient_name: z.string().describe("Patient's name as they gave it"),
        patient_phone: z.string().describe("Phone number, e.g. +998 90 123 45 67"),
        service_ref: z.string().optional().describe('Service reference from the facts, e.g. "S1"'),
        dentist_ref: z.string().optional().describe('Dentist reference from the facts, e.g. "D1"'),
        preferred_date: z.string().optional().describe("YYYY-MM-DD"),
        preferred_time: z.string().optional().describe('Preferred time or part of day, e.g. "morning" or "after 15:00"'),
        notes: z.string().optional().describe("Short reason for the visit in the patient's words, no medical advice"),
      }),
      execute: async (input) => {
        if (requestsSoFar >= MAX_REQUESTS_PER_CONVERSATION) {
          return fail("limit_reached", "Requests already sent; offer to connect with staff for changes.");
        }

        const name = input.patient_name.trim();
        if (name.length < 1 || name.length > 120) return fail("invalid_name", "Ask for the patient's name.");

        const phone = input.patient_phone.trim();
        if (!PHONE_PATTERN.test(phone) || phone.replace(/\D/g, "").length < 9) {
          return fail("invalid_phone", "The phone number looks wrong; ask for it again with the country code.");
        }

        const service = input.service_ref ? facts.services.find((s) => s.ref === input.service_ref?.trim()) : undefined;
        if (input.service_ref && !service) return fail("unknown_service", "That service is not listed; ask which listed service they want.");

        const dentist = input.dentist_ref ? facts.dentists.find((d) => d.ref === input.dentist_ref?.trim()) : undefined;
        if (input.dentist_ref && !dentist) return fail("unknown_dentist", "That dentist is not listed.");

        let date: string | null = null;
        if (input.preferred_date) {
          date = input.preferred_date.trim();
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
            return fail("invalid_date", "Ask for the date again.");
          }
          if (date < clock.date) return fail("date_in_past", "That date has passed; ask for a future date.");
          if (date > addDays(clock.date, MAX_DAYS_AHEAD)) {
            return fail("date_too_far", `Requests can be at most ${MAX_DAYS_AHEAD} days ahead.`);
          }
          if (facts.hoursSet && facts.hours[dayOf(date)].length === 0) {
            return fail("clinic_closed", "The clinic is closed that day; suggest a day it is open.");
          }
        }

        const preferredTime = input.preferred_time?.trim().slice(0, 60) || null;
        const notes = input.notes?.trim().slice(0, 500) || null;

        const { id } = await actions.createAppointmentRequest({
          patientName: name,
          patientPhone: phone,
          serviceId: service?.id ?? null,
          dentistId: dentist?.id ?? null,
          preferredDate: date,
          preferredTime,
          notes,
        });
        requestsSoFar += 1;
        return {
          ok: true as const,
          request_id: id,
          status: "requested",
          message: "Request sent to the clinic. Tell the patient the clinic will contact them to confirm; it is not booked yet.",
        };
      },
    }),

    request_handoff: tool({
      description: "Ask a clinic staff member to take over this conversation.",
      inputSchema: z.object({
        reason: z.string().describe("One short sentence on why a human is needed"),
      }),
      execute: async ({ reason }) => {
        await actions.requestHandoff(reason.trim().slice(0, 300) || "Patient asked for staff");
        return { ok: true as const, message: "Staff notified. Tell the patient a staff member will reply." };
      },
    }),
  };
}
