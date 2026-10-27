import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/form-parts";
import { getClinicContext } from "@/lib/admin/clinic-context";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { readOpeningHours } from "@/lib/validation/clinic";

export default async function ClinicOverviewPage({ params }: PageProps<"/dashboard/[slug]">) {
  const { slug } = await params;
  const clinic = await getClinicContext(slug);
  if (!clinic) notFound();

  const { t } = await getT();
  const supabase = await createClient();
  const count = (table: "services" | "dentists" | "faqs") =>
    supabase.from(table).select("id", { count: "exact", head: true }).eq("clinic_id", clinic.id).eq("is_active", true);

  const [profile, services, dentists, faqs] = await Promise.all([
    supabase.from("clinic_profiles").select("phone, address_uz, address_ru, opening_hours").eq("clinic_id", clinic.id).maybeSingle(),
    count("services"),
    count("dentists"),
    count("faqs"),
  ]);

  const p = profile.data;
  const hours = readOpeningHours(p?.opening_hours);
  const base = `/dashboard/${clinic.slug}`;

  const items = [
    { label: t.overview.profileDone, href: `${base}/profile`, done: Boolean(p?.phone && (p.address_uz || p.address_ru)) },
    { label: t.overview.hoursDone, href: `${base}/hours`, done: Object.values(hours).some((d) => d.length > 0) },
    { label: t.overview.servicesCount, href: `${base}/services`, done: (services.count ?? 0) > 0, count: services.count ?? 0 },
    { label: t.overview.dentistsCount, href: `${base}/dentists`, done: (dentists.count ?? 0) > 0, count: dentists.count ?? 0 },
    { label: t.overview.faqsCount, href: `${base}/faqs`, done: (faqs.count ?? 0) > 0, count: faqs.count ?? 0 },
  ];

  return (
    <>
      <PageHeader title={t.overview.title} intro={t.overview.intro} />
      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50">
              <span className="text-sm font-medium text-slate-900">
                {item.label}
                {item.count !== undefined ? <span className="ml-2 text-slate-500">{item.count}</span> : null}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  item.done ? "bg-teal-50 text-teal-800" : "bg-amber-50 text-amber-800"
                }`}
              >
                {item.done ? t.overview.done : t.overview.todo}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
