import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../login/actions";

export const metadata: Metadata = {
  title: "Boshqaruv paneli · Панель",
};

export default function DashboardPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Boshqaruv paneli
          </h1>
          <p className="text-sm text-slate-500">Панель управления</p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Chiqish · Выйти
          </button>
        </form>
      </header>

      <section className="mt-8">
        {/* Reads the session, so it streams in at request time. */}
        <Suspense fallback={<p className="text-sm text-slate-500">Yuklanmoqda… · Загрузка…</p>}>
          <ClinicList />
        </Suspense>
      </section>
    </main>
  );
}

async function ClinicList() {
  const supabase = await createClient();

  // proxy.ts already redirects signed-out visitors; this is defence in depth.
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) {
    redirect("/login");
  }

  // Row level security limits this to clinics the user belongs to.
  const { data: clinics, error } = await supabase
    .from("clinics")
    .select("id, name, slug, status")
    .order("name");

  if (error) {
    return (
      <p role="alert" className="text-sm text-red-700">
        Ma’lumotlarni yuklab bo‘lmadi. · Не удалось загрузить данные.
      </p>
    );
  }

  if (!clinics || clinics.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-600">
        Hisobingiz hali klinikaga ulanmagan. · Ваш аккаунт ещё не привязан к клинике.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
      {clinics.map((clinic) => (
        <li key={clinic.id} className="flex items-center justify-between px-4 py-3">
          <span className="font-medium text-slate-900">{clinic.name}</span>
          <span className="text-sm text-slate-500">/{clinic.slug}</span>
        </li>
      ))}
    </ul>
  );
}
