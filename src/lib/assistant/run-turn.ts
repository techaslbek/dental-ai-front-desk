import { generateText, isStepCount, type LanguageModel, type ModelMessage } from "ai";
import type { ClinicFacts } from "./facts";
import { buildInstructions, PROMPT_VERSION, type ConversationState } from "./prompt";
import { clinicClock } from "./time";
import { createAssistantTools, type AssistantActions } from "./tools";

export type HistoryMessage = { role: "patient" | "assistant" | "staff"; content: string };

export type TurnResult = {
  text: string;
  inputTokens: number;
  outputTokens: number;
  appointmentRequested: boolean;
  handoffRequested: boolean;
  toolCalls: { name: string; input: unknown; output: unknown }[];
  promptVersion: string;
};

// Recent turns only: enough for booking flows, bounded cost per message.
export const HISTORY_LIMIT = 20;

function toModelMessages(history: HistoryMessage[]): ModelMessage[] {
  return history.slice(-HISTORY_LIMIT).map((m) =>
    m.role === "patient"
      ? { role: "user", content: m.content }
      : // Staff replies are shown to the model as clinic messages so it keeps context.
        { role: "assistant", content: m.role === "staff" ? `[Clinic staff] ${m.content}` : m.content },
  );
}

// One assistant reply. Pure apart from the injected model and actions, so the
// API route, unit tests and evaluations all exercise the same code.
export async function runAssistantTurn(opts: {
  model: LanguageModel;
  facts: ClinicFacts;
  history: HistoryMessage[];
  state: ConversationState & { requestsSoFar: number };
  actions: AssistantActions;
  now?: Date;
  providerOptions?: Parameters<typeof generateText>[0]["providerOptions"];
  abortSignal?: AbortSignal;
}): Promise<TurnResult> {
  const clock = clinicClock(opts.now ?? new Date());
  let appointmentRequested = false;
  let handoffRequested = false;

  const tools = createAssistantTools({
    facts: opts.facts,
    clock,
    requestsSoFar: opts.state.requestsSoFar,
    actions: {
      createAppointmentRequest: async (input) => {
        const result = await opts.actions.createAppointmentRequest(input);
        appointmentRequested = true;
        return result;
      },
      requestHandoff: async (reason) => {
        await opts.actions.requestHandoff(reason);
        handoffRequested = true;
      },
    },
  });

  const result = await generateText({
    model: opts.model,
    instructions: buildInstructions(opts.facts, clock, opts.state),
    messages: toModelMessages(opts.history),
    tools,
    // Tool call, then a reply that uses its result; a third step allows one retry.
    stopWhen: isStepCount(3),
    maxOutputTokens: 600,
    timeout: { totalMs: 45_000 },
    providerOptions: opts.providerOptions,
    abortSignal: opts.abortSignal,
  });

  const toolCalls = result.steps.flatMap((step) =>
    step.toolResults.map((r) => ({ name: r.toolName, input: r.input, output: r.output })),
  );

  return {
    text: result.text.trim(),
    inputTokens: result.usage.inputTokens ?? 0,
    outputTokens: result.usage.outputTokens ?? 0,
    appointmentRequested,
    handoffRequested,
    toolCalls,
    promptVersion: PROMPT_VERSION,
  };
}
