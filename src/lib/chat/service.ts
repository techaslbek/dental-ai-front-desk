import "server-only";
import { createHmac } from "node:crypto";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { loadClinicFacts } from "@/lib/assistant/facts";
import { PROMPT_VERSION } from "@/lib/assistant/prompt";
import { HISTORY_LIMIT, runAssistantTurn, type HistoryMessage } from "@/lib/assistant/run-turn";
import { getServerEnv } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fallbackReply } from "./fallbacks";
import { detectLanguage, localeFamily } from "./language";

// Patient chat. Runs with the secret key because patients are anonymous;
// every query below is scoped to the clinic resolved from the slug and to the
// conversation owned by this browser's visitor id.

export const MAX_MESSAGE_CHARS = 1000;
export const MAX_MESSAGES_PER_CONVERSATION = 60;
const LIMITS = {
  messagesPerIp: { limit: 30, windowSeconds: 600 },
  messagesPerVisitor: { limit: 20, windowSeconds: 600 },
  conversationsPerIp: { limit: 6, windowSeconds: 3600 },
};

export const chatRequestSchema = z.object({
  clinic: z.string().min(3).max(48),
  visitorId: z.uuid(),
  conversationId: z.uuid().nullish(),
  message: z.string().trim().min(1).max(MAX_MESSAGE_CHARS),
  consent: z.boolean().optional(),
  channel: z.enum(["web", "hosted"]).default("hosted"),
});

export const historyRequestSchema = z.object({
  clinic: z.string().min(3).max(48),
  visitorId: z.uuid(),
  conversationId: z.uuid(),
});

export type ChatResponse = {
  conversationId: string;
  reply: string;
  appointmentRequested: boolean;
  handoffRequested: boolean;
};

export class ChatError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

// Clients are identified only by a keyed hash: no raw IPs are stored.
function hashKey(value: string) {
  return createHmac("sha256", getServerEnv().SUPABASE_SECRET_KEY).update(value).digest("hex").slice(0, 32);
}

type Admin = ReturnType<typeof createAdminClient>;

async function allowed(admin: Admin, key: string, rule: { limit: number; windowSeconds: number }) {
  const { data, error } = await admin.rpc("consume_rate_limit", {
    p_key: key,
    p_limit: rule.limit,
    p_window_seconds: rule.windowSeconds,
  });
  if (error) throw new Error(`rate limit check failed: ${error.code}`);
  return data === true;
}

async function getActiveClinic(admin: Admin, slug: string) {
  const { data, error } = await admin
    .from("clinics")
    .select("id, name, slug, default_locale, status, plans(monthly_conversation_limit, monthly_message_limit)")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`clinic lookup failed: ${error.code}`);
  if (!data || data.status !== "active") throw new ChatError(404, "clinic_not_found");
  return data;
}

export async function handleChatMessage(input: z.infer<typeof chatRequestSchema>, clientIp: string): Promise<ChatResponse> {
  const env = getServerEnv();
  const admin = createAdminClient();
  const ipKey = hashKey(`ip:${clientIp}`);

  const clinic = await getActiveClinic(admin, input.clinic);
  const { data: profile } = await admin.from("clinic_profiles").select("phone").eq("clinic_id", clinic.id).maybeSingle();
  const phone = profile?.phone ?? null;
  const lang = detectLanguage(input.message, clinic.default_locale === "ru" ? "ru" : "uz");

  // Abuse limits come first so floods never reach the model.
  const withinLimits =
    (await allowed(admin, `chat:ip:${ipKey}`, LIMITS.messagesPerIp)) &&
    (await allowed(admin, `chat:visitor:${input.visitorId}`, LIMITS.messagesPerVisitor));
  if (!withinLimits) throw new ChatError(429, fallbackReply("rateLimited", lang, phone));

  const month = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" }).slice(0, 7) + "-01";
  const { data: usage } = await admin
    .from("usage_monthly")
    .select("conversations, messages")
    .eq("clinic_id", clinic.id)
    .eq("month", month)
    .maybeSingle();
  const plan = clinic.plans;

  // Find or start the conversation.
  let conversationId = input.conversationId ?? null;
  let conversation: { id: string; status: string } | null = null;
  if (conversationId) {
    const { data } = await admin
      .from("conversations")
      .select("id, status")
      .eq("id", conversationId)
      .eq("clinic_id", clinic.id)
      .eq("visitor_id", input.visitorId)
      .maybeSingle();
    if (!data) throw new ChatError(404, "conversation_not_found");
    if (data.status === "closed") throw new ChatError(409, "conversation_closed");
    conversation = data;
  } else {
    if (input.consent !== true) throw new ChatError(400, "consent_required");
    if (!(await allowed(admin, `chat:new:${ipKey}`, LIMITS.conversationsPerIp))) {
      throw new ChatError(429, fallbackReply("rateLimited", lang, phone));
    }
    if (plan && (usage?.conversations ?? 0) >= plan.monthly_conversation_limit) {
      throw new ChatError(429, fallbackReply("clinicLimit", lang, phone));
    }
    const { data, error } = await admin
      .from("conversations")
      .insert({
        clinic_id: clinic.id,
        visitor_id: input.visitorId,
        channel: input.channel,
        locale: localeFamily(lang),
        consent_at: new Date().toISOString(),
      })
      .select("id, status")
      .single();
    if (error) throw new Error(`conversation insert failed: ${error.code}`);
    conversation = data;
    conversationId = data.id;
    await admin.rpc("record_usage", { p_clinic_id: clinic.id, p_conversations: 1, p_messages: 0, p_input_tokens: 0, p_output_tokens: 0 });
  }
  const convId = conversationId!;

  const { count: messageCount } = await admin
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", convId)
    .eq("clinic_id", clinic.id);

  const { error: insertError } = await admin
    .from("messages")
    .insert({ conversation_id: convId, clinic_id: clinic.id, role: "patient", content: input.message });
  if (insertError) throw new Error(`message insert failed: ${insertError.code}`);

  // Limits that end in a fixed reply rather than a model call.
  let fixedReply: string | null = null;
  if ((messageCount ?? 0) >= MAX_MESSAGES_PER_CONVERSATION) fixedReply = fallbackReply("conversationLimit", lang, phone);
  else if (plan && (usage?.messages ?? 0) >= plan.monthly_message_limit) fixedReply = fallbackReply("clinicLimit", lang, phone);

  let reply: string;
  let appointmentRequested = false;
  let handoffRequested = false;
  let tokens = { input: 0, output: 0 };
  let model: string | null = null;

  if (fixedReply) {
    reply = fixedReply;
  } else {
    try {
      const [facts, history, requests, handoffs] = await Promise.all([
        loadClinicFacts(admin, clinic),
        admin
          .from("messages")
          .select("role, content")
          .eq("conversation_id", convId)
          .eq("clinic_id", clinic.id)
          .in("role", ["patient", "assistant", "staff"])
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(HISTORY_LIMIT),
        admin.from("appointment_requests").select("id", { count: "exact", head: true }).eq("conversation_id", convId).eq("clinic_id", clinic.id),
        admin.from("handoffs").select("id", { count: "exact", head: true }).eq("conversation_id", convId).eq("clinic_id", clinic.id),
      ]);
      if (history.error) throw new Error(`history load failed: ${history.error.code}`);

      const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
      const turn = await runAssistantTurn({
        model: openai(env.OPENAI_MODEL),
        facts,
        history: (history.data as HistoryMessage[]).reverse(),
        state: {
          appointmentRequested: (requests.count ?? 0) > 0,
          handoffRequested: (handoffs.count ?? 0) > 0 || conversation!.status === "handoff",
          requestsSoFar: requests.count ?? 0,
        },
        providerOptions: {
          openai: {
            store: false,
            reasoningEffort: "low",
            promptCacheKey: `clinic:${clinic.id}:${PROMPT_VERSION}`,
            safetyIdentifier: hashKey(`visitor:${input.visitorId}`),
          },
        },
        actions: {
          createAppointmentRequest: async (r) => {
            const { data, error } = await admin
              .from("appointment_requests")
              .insert({
                clinic_id: clinic.id,
                conversation_id: convId,
                patient_name: r.patientName,
                patient_phone: r.patientPhone,
                service_id: r.serviceId,
                dentist_id: r.dentistId,
                preferred_date: r.preferredDate,
                preferred_time: r.preferredTime,
                notes: r.notes,
              })
              .select("id")
              .single();
            if (error) throw new Error(`appointment insert failed: ${error.code}`);
            return data;
          },
          requestHandoff: async (reason) => {
            const { count } = await admin
              .from("handoffs")
              .select("id", { count: "exact", head: true })
              .eq("conversation_id", convId)
              .eq("clinic_id", clinic.id)
              .neq("status", "resolved");
            if (!count) {
              const { error } = await admin.from("handoffs").insert({ clinic_id: clinic.id, conversation_id: convId, reason });
              if (error) throw new Error(`handoff insert failed: ${error.code}`);
            }
            await admin.from("conversations").update({ status: "handoff" }).eq("id", convId).eq("clinic_id", clinic.id);
          },
        },
      });
      reply = turn.text || fallbackReply("technical", lang, phone);
      appointmentRequested = turn.appointmentRequested;
      handoffRequested = turn.handoffRequested;
      tokens = { input: turn.inputTokens, output: turn.outputTokens };
      model = env.OPENAI_MODEL;
    } catch (error) {
      // Log the failure type only; never message content or patient details.
      console.error("chat turn failed", { clinic: clinic.id, error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
      reply = fallbackReply("technical", lang, phone);
    }
  }

  await admin.from("messages").insert({
    conversation_id: convId,
    clinic_id: clinic.id,
    role: "assistant",
    content: reply.slice(0, 4000),
    model,
    input_tokens: tokens.input,
    output_tokens: tokens.output,
  });
  await admin
    .from("conversations")
    .update({ last_message_at: new Date().toISOString(), locale: localeFamily(lang) })
    .eq("id", convId)
    .eq("clinic_id", clinic.id);
  await admin.rpc("record_usage", {
    p_clinic_id: clinic.id,
    p_conversations: 0,
    p_messages: 1,
    p_input_tokens: tokens.input,
    p_output_tokens: tokens.output,
  });

  return { conversationId: convId, reply, appointmentRequested, handoffRequested };
}

// Restores a conversation after a page reload. The visitor id (random, kept
// in the patient's browser) is required, so ids alone reveal nothing.
export async function loadConversation(input: z.infer<typeof historyRequestSchema>) {
  const admin = createAdminClient();
  const clinic = await getActiveClinic(admin, input.clinic);
  const { data: conversation } = await admin
    .from("conversations")
    .select("id, status")
    .eq("id", input.conversationId)
    .eq("clinic_id", clinic.id)
    .eq("visitor_id", input.visitorId)
    .maybeSingle();
  if (!conversation) throw new ChatError(404, "conversation_not_found");

  const { data } = await admin
    .from("messages")
    .select("role, content, created_at")
    .eq("conversation_id", conversation.id)
    .eq("clinic_id", clinic.id)
    .in("role", ["patient", "assistant", "staff"])
    .order("created_at")
    .order("id")
    .limit(200);
  return { status: conversation.status, messages: data ?? [] };
}
