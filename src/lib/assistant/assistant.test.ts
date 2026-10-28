import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it, vi } from "vitest";
import { renderFacts } from "./facts";
import { buildInstructions } from "./prompt";
import { runAssistantTurn } from "./run-turn";
import { testFacts, testNow } from "./test-fixtures";
import { addDays, clinicClock, dayOf, isOpenAt } from "./time";
import { createAssistantTools, type AssistantActions } from "./tools";

const usage = {
  inputTokens: { total: 1200, noCache: 1200, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 40, text: 40, reasoning: undefined },
};

function recorder() {
  const requests: unknown[] = [];
  const handoffs: string[] = [];
  const actions: AssistantActions = {
    createAppointmentRequest: vi.fn(async (input) => {
      requests.push(input);
      return { id: `req-${requests.length}` };
    }),
    requestHandoff: vi.fn(async (reason) => {
      handoffs.push(reason);
    }),
  };
  return { actions, requests, handoffs };
}

const clock = clinicClock(testNow);

async function callBooking(input: Record<string, unknown>, requestsSoFar = 0) {
  const { actions, requests } = recorder();
  const tools = createAssistantTools({ facts: testFacts, clock, actions, requestsSoFar });
  const output = await tools.create_appointment_request.execute!(input as never, {
    toolCallId: "t1",
    messages: [],
  } as never);
  return { output: output as { ok: boolean; error?: string }, requests };
}

describe("clinic clock", () => {
  it("uses Tashkent time", () => {
    expect(clock).toEqual({ date: "2026-10-28", day: "wed", time: "10:30" });
    expect(clinicClock(new Date("2026-10-28T20:30:00Z"))).toEqual({ date: "2026-10-29", day: "thu", time: "01:30" });
  });

  it("knows when the clinic is open", () => {
    expect(isOpenAt(testFacts.hours, clock)).toBe(true);
    expect(isOpenAt(testFacts.hours, { date: "2026-11-01", day: "sun", time: "10:00" })).toBe(false);
    expect(isOpenAt(testFacts.hours, { date: "2026-10-31", day: "sat", time: "14:00" })).toBe(false);
  });

  it("does calendar maths without time zone drift", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(dayOf("2026-11-01")).toBe("sun");
  });
});

describe("create_appointment_request", () => {
  const valid = { patient_name: "Test Bemor", patient_phone: "+998 90 111 22 33", service_ref: "S1", preferred_date: "2026-10-30" };

  it("maps references to ids and records a request", async () => {
    const { output, requests } = await callBooking({ ...valid, dentist_ref: "D1", preferred_time: "ertalab" });
    expect(output.ok).toBe(true);
    expect(requests).toEqual([
      {
        patientName: "Test Bemor",
        patientPhone: "+998 90 111 22 33",
        serviceId: testFacts.services[0].id,
        dentistId: testFacts.dentists[0].id,
        preferredDate: "2026-10-30",
        preferredTime: "ertalab",
        notes: null,
      },
    ]);
  });

  it.each([
    [{ patient_phone: "12345" }, "invalid_phone"],
    [{ service_ref: "S9" }, "unknown_service"],
    [{ dentist_ref: "D9" }, "unknown_dentist"],
    [{ preferred_date: "2026-10-27" }, "date_in_past"],
    [{ preferred_date: "2027-03-01" }, "date_too_far"],
    [{ preferred_date: "2026-11-01" }, "clinic_closed"],
    [{ preferred_date: "next friday" }, "invalid_date"],
    [{ patient_name: "  " }, "invalid_name"],
  ])("rejects %o with %s and records nothing", async (override, error) => {
    const { output, requests } = await callBooking({ ...valid, ...override });
    expect(output).toMatchObject({ ok: false, error });
    expect(requests).toHaveLength(0);
  });

  it("caps requests per conversation", async () => {
    const { output } = await callBooking(valid, 2);
    expect(output).toMatchObject({ ok: false, error: "limit_reached" });
  });
});

describe("instructions", () => {
  it("contain the facts, the time and the no-confirmation rule", () => {
    const text = buildInstructions(testFacts, clock, { appointmentRequested: false, handoffRequested: false });
    expect(text).toContain("[S1] uz: Professional tish tozalash");
    expect(text).toContain("from 300 000 to 550 000 UZS");
    expect(text).toContain("price not published");
    expect(text).toContain("Today is 2026-10-28 (wed), time 10:30");
    expect(text).toContain("currently open");
    expect(text).toMatch(/Never say an appointment is booked, confirmed or reserved/);
  });

  it("render closed days and missing data plainly", () => {
    const facts = renderFacts({ ...testFacts, dentists: [], faqs: [] });
    expect(facts).toContain("- sun: closed");
    expect(facts).toContain("Dentists:\n- none listed");
  });
});

describe("runAssistantTurn", () => {
  it("runs a tool call and returns the follow-up reply with usage", async () => {
    let call = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        call += 1;
        return call === 1
          ? {
              content: [
                {
                  type: "tool-call",
                  toolCallId: "c1",
                  toolName: "create_appointment_request",
                  input: JSON.stringify({ patient_name: "Ali", patient_phone: "+998901112233", service_ref: "S2" }),
                },
              ],
              finishReason: { unified: "tool-calls", raw: undefined },
              usage,
              warnings: [],
            }
          : {
              content: [{ type: "text", text: " So‘rovingiz yuborildi. Klinika siz bilan bog‘lanib vaqtni tasdiqlaydi. " }],
              finishReason: { unified: "stop", raw: undefined },
              usage,
              warnings: [],
            };
      },
    });
    const { actions, requests } = recorder();

    const result = await runAssistantTurn({
      model,
      facts: testFacts,
      history: [{ role: "patient", content: "Ali, +998901112233, plomba" }],
      state: { appointmentRequested: false, handoffRequested: false, requestsSoFar: 0 },
      actions,
      now: testNow,
    });

    expect(result.text).toBe("So‘rovingiz yuborildi. Klinika siz bilan bog‘lanib vaqtni tasdiqlaydi.");
    expect(result.appointmentRequested).toBe(true);
    expect(result.handoffRequested).toBe(false);
    expect(requests).toHaveLength(1);
    expect(result.inputTokens).toBe(2400);
    expect(result.outputTokens).toBe(80);
    expect(result.toolCalls[0]).toMatchObject({ name: "create_appointment_request" });
  });
});
