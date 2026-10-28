"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Messages } from "@/lib/i18n";

type ChatLabels = Messages["chat"];
type Bubble =
  | { kind: "message"; role: "patient" | "assistant" | "staff"; content: string }
  | { kind: "notice"; tone: "request" | "handoff" | "error"; content: string };

type Stored = { visitorId: string; conversationId: string | null };

const MAX_CHARS = 1000;

// Per-clinic browser state: a random visitor id (not linked to any identity)
// and the open conversation. localStorage can be unavailable; then the chat
// still works, it just won't survive a reload.
function readStored(slug: string): Stored {
  try {
    const raw = window.localStorage.getItem(`dafd:chat:${slug}`);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Stored>;
      if (typeof parsed.visitorId === "string") {
        return { visitorId: parsed.visitorId, conversationId: parsed.conversationId ?? null };
      }
    }
  } catch {}
  return { visitorId: crypto.randomUUID(), conversationId: null };
}

function writeStored(slug: string, value: Stored) {
  try {
    window.localStorage.setItem(`dafd:chat:${slug}`, JSON.stringify(value));
  } catch {}
}

type ChatProps = {
  clinicSlug: string;
  phone: string | null;
  labels: ChatLabels;
  channel?: "hosted" | "web";
};

const noopSubscribe = () => () => {};

// The chat depends on browser storage, so it renders only after hydration;
// the server sends a same-sized placeholder.
export function ChatWindow(props: ChatProps) {
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!isClient) return <div className="h-64 rounded-xl border border-slate-200 bg-white" aria-busy="true" />;
  return <ChatWindowInner {...props} />;
}

function ChatWindowInner({ clinicSlug, phone, labels, channel = "hosted" }: ChatProps) {
  const [stored, setStored] = useState<Stored>(() => {
    const s = readStored(clinicSlug);
    writeStored(clinicSlug, s);
    return s;
  });
  const [consented, setConsented] = useState(() => stored.conversationId !== null);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [closed, setClosed] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Restore an earlier conversation from this browser (once, on mount).
  const [initial] = useState(stored);
  useEffect(() => {
    const s = initial;
    if (!s.conversationId) return;
    fetch("/api/chat/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clinic: clinicSlug, visitorId: s.visitorId, conversationId: s.conversationId }),
    })
      .then(async (res) => {
        if (!res.ok) {
          // Unknown or expired conversation: start fresh next time.
          const fresh = { ...s, conversationId: null };
          setStored(fresh);
          writeStored(clinicSlug, fresh);
          setConsented(false);
          return;
        }
        const data = (await res.json()) as {
          status: string;
          messages: { role: "patient" | "assistant" | "staff"; content: string }[];
        };
        setBubbles(data.messages.map((m) => ({ kind: "message", role: m.role, content: m.content })));
        setClosed(data.status === "closed");
      })
      .catch(() => {});
  }, [clinicSlug, initial]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [bubbles, pending]);

  async function send() {
    const message = draft.trim();
    if (!message || pending || closed) return;
    setDraft("");
    setPending(true);
    setBubbles((b) => [...b, { kind: "message", role: "patient", content: message }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinic: clinicSlug,
          visitorId: stored.visitorId,
          conversationId: stored.conversationId,
          message,
          consent: stored.conversationId ? undefined : true,
          channel,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        if (data.conversationId !== stored.conversationId) {
          const next = { ...stored, conversationId: data.conversationId as string };
          setStored(next);
          writeStored(clinicSlug, next);
        }
        setBubbles((b) => [
          ...b,
          { kind: "message", role: "assistant", content: data.reply as string },
          // Fixed wording, independent of the model, so the patient always
          // learns that a request is not a confirmed booking.
          ...(data.appointmentRequested ? [{ kind: "notice", tone: "request", content: labels.requestSent } as const] : []),
          ...(data.handoffRequested ? [{ kind: "notice", tone: "handoff", content: labels.handoffNotice } as const] : []),
        ]);
      } else if (res.status === 429 && typeof data.reply === "string") {
        setBubbles((b) => [...b, { kind: "notice", tone: "error", content: data.reply }]);
      } else if (res.status === 409) {
        setClosed(true);
      } else {
        setBubbles((b) => [
          ...b,
          { kind: "notice", tone: "error", content: `${labels.unavailable}${phone ? ` ${labels.callUs} ${phone}` : ""}` },
        ]);
      }
    } catch {
      setBubbles((b) => [
        ...b,
        { kind: "notice", tone: "error", content: `${labels.unavailable}${phone ? ` ${labels.callUs} ${phone}` : ""}` },
      ]);
    } finally {
      setPending(false);
    }
  }

  function newConversation() {
    const next = { ...stored, conversationId: null };
    setStored(next);
    writeStored(clinicSlug, next);
    setBubbles([]);
    setClosed(false);
    setConsented(false);
  }

  if (!consented) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">{labels.noticeTitle}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">{labels.notice}</p>
        <p className="mt-2 text-sm font-medium text-red-700">{labels.emergency}</p>
        <button
          type="button"
          onClick={() => setConsented(true)}
          className="mt-5 w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {labels.start}
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-[min(36rem,calc(100dvh-10rem))] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite" aria-relevant="additions">
        {bubbles.map((b, i) =>
          b.kind === "message" ? (
            <div key={i} className={`flex ${b.role === "patient" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-6 whitespace-pre-wrap break-words ${
                  b.role === "patient" ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-900"
                }`}
              >
                <span className="sr-only">{b.role === "patient" ? labels.you : b.role === "staff" ? labels.staff : labels.assistant}: </span>
                {b.role === "staff" ? <span className="mb-0.5 block text-xs font-semibold text-teal-800">{labels.staff}</span> : null}
                {b.content}
              </div>
            </div>
          ) : (
            <p
              key={i}
              role={b.tone === "error" ? "alert" : "status"}
              className={`rounded-lg px-3 py-2 text-sm ${
                b.tone === "error" ? "bg-red-50 text-red-800" : b.tone === "request" ? "bg-amber-50 text-amber-900" : "bg-teal-50 text-teal-900"
              }`}
            >
              {b.content}
            </p>
          ),
        )}
        {pending ? <p className="text-sm text-slate-500">{labels.typing}</p> : null}
      </div>

      {closed ? (
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 p-3 text-sm text-slate-600">
          {labels.closed}
          <button type="button" onClick={newConversation} className="rounded-md bg-teal-700 px-3 py-1.5 font-semibold text-white">
            {labels.newChat}
          </button>
        </div>
      ) : (
        <form
          className="flex items-end gap-2 border-t border-slate-200 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label htmlFor="chat-input" className="sr-only">
            {labels.placeholder}
          </label>
          <textarea
            id="chat-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_CHARS))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            maxLength={MAX_CHARS}
            placeholder={labels.placeholder}
            className="max-h-32 min-h-10 flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30"
          />
          <button
            type="submit"
            disabled={pending || !draft.trim()}
            className="h-10 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {labels.send}
          </button>
        </form>
      )}
      <p className="border-t border-slate-100 px-3 py-1.5 text-center text-xs text-slate-500">{labels.disclaimer}</p>
    </div>
  );
}
