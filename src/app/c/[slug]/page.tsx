import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ChatWindow } from "@/components/chat/chat-window";
import { getMessages } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n/locales";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Onlayn administrator · Онлайн-администратор",
  robots: { index: false },
};

// Public patient page. Patients are anonymous, so the clinic is read with the
// secret key on the server, and only public fields leave this component.
export default function PatientChatPage(props: PageProps<"/c/[slug]">) {
  return (
    <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
      <PatientChat {...props} />
    </Suspense>
  );
}

async function PatientChat({ params, searchParams }: PageProps<"/c/[slug]">) {
  await connection();
  const { slug } = await params;
  const { lang } = await searchParams;

  let clinic: { name: string; slug: string; defaultLocale: string; phone: string | null } | null = null;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("clinics")
      .select("id, name, slug, default_locale, status")
      .eq("slug", typeof slug === "string" ? slug.slice(0, 48) : "")
      .maybeSingle();
    if (data && data.status === "active") {
      const { data: profile } = await admin.from("clinic_profiles").select("phone").eq("clinic_id", data.id).maybeSingle();
      clinic = { name: data.name, slug: data.slug, defaultLocale: data.default_locale, phone: profile?.phone ?? null };
    }
  } catch {
    // Missing server configuration: show the "unavailable" state below.
  }

  const locale = isLocale(lang) ? lang : clinic && isLocale(clinic.defaultLocale) ? clinic.defaultLocale : "uz";
  const t = getMessages(locale).chat;
  const other = locale === "uz" ? "ru" : "uz";

  if (!clinic) {
    return (
      <main lang={locale} className="mx-auto w-full max-w-xl flex-1 px-4 py-16 text-center text-slate-600">
        {t.notFound}
      </main>
    );
  }

  return (
    <main lang={locale} className="mx-auto w-full max-w-xl flex-1 px-4 py-6 sm:py-10">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{clinic.name}</h1>
          <p className="text-sm text-slate-600">
            {t.title} · {t.subtitle}
          </p>
        </div>
        <a
          href={`?lang=${other}`}
          lang={other}
          className="shrink-0 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          {other === "ru" ? "Русский" : "O‘zbekcha"}
        </a>
      </header>
      <ChatWindow clinicSlug={clinic.slug} phone={clinic.phone} labels={t} />
      {clinic.phone ? (
        <p className="mt-3 text-center text-sm text-slate-600">
          {t.callUs}{" "}
          <a href={`tel:${clinic.phone.replace(/[^\d+]/g, "")}`} className="font-medium text-teal-800 underline">
            {clinic.phone}
          </a>
        </p>
      ) : null}
    </main>
  );
}
