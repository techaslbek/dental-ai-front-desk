import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/admin/form-parts";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/admin/page-skeleton";

export const metadata: Metadata = {
  title: "Boshqaruv paneli · Панель",
};

const MAX_OWNED_CLINICS = 3;

export default function DashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DashboardPageContent />
    </Suspense>
  );
}

async function DashboardPageContent() {
  const { t } = await getT();
  const supabase = await createClient();

  // proxy.ts already redirects signed-out visitors; this is defence in depth.
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect("/login");

  // Row level security limits this to clinics the user belongs to.
  const { data: clinics, error } = await supabase
    .from("clinics")
    .select("id, name, slug, clinic_members!inner(role)")
    .eq("clinic_members.user_id", userId)
    .order("name");

  const owned = clinics?.filter((c) => c.clinic_members[0]?.role === "owner").length ?? 0;
  const canCreate = !error && owned < MAX_OWNED_CLINICS;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
      <PageHeader
        title={t.dashboard.title}
        action={
          canCreate ? (
            <Link
              href="/dashboard/new"
              className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
            >
              {t.dashboard.createClinic}
            </Link>
          ) : null
        }
      />

      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {t.dashboard.loadFailed}
        </p>
      ) : clinics.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-600">
          {t.dashboard.noClinics}
        </p>
      ) : (
        <section aria-labelledby="clinics-heading">
          <h2 id="clinics-heading" className="mb-3 text-sm font-medium text-slate-500">
            {t.dashboard.yourClinics}
          </h2>
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {clinics.map((clinic) => (
              <li key={clinic.id}>
                <Link
                  href={`/dashboard/${clinic.slug}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50"
                >
                  <span className="font-medium text-slate-900">{clinic.name}</span>
                  <span className="text-sm text-slate-500">
                    {clinic.clinic_members[0]?.role === "owner" ? t.dashboard.roleOwner : t.dashboard.roleStaff}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
