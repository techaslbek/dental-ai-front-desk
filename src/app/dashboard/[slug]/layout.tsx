import Link from "next/link";
import { notFound } from "next/navigation";
import { NavLinks } from "@/components/admin/nav-links";
import { getClinicContext } from "@/lib/admin/clinic-context";
import { getT } from "@/lib/i18n/server";

export default async function ClinicLayout({ children, params }: LayoutProps<"/dashboard/[slug]">) {
  const { slug } = await params;
  const clinic = await getClinicContext(slug);
  if (!clinic) notFound();

  const { t } = await getT();
  const base = `/dashboard/${clinic.slug}`;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 md:flex-row md:gap-10 md:py-10">
      <aside className="md:w-56 md:shrink-0">
        <Link href="/dashboard" className="text-xs font-medium text-slate-500 hover:text-slate-700">
          ← {t.nav.allClinics}
        </Link>
        <p className="mt-2 mb-4 truncate text-base font-semibold text-slate-900" title={clinic.name}>
          {clinic.name}
        </p>
        <NavLinks
          label={clinic.name}
          items={[
            { href: base, label: t.nav.overview, exact: true },
            { href: `${base}/profile`, label: t.nav.profile },
            { href: `${base}/hours`, label: t.nav.hours },
            { href: `${base}/services`, label: t.nav.services },
            { href: `${base}/dentists`, label: t.nav.dentists },
            { href: `${base}/faqs`, label: t.nav.faqs },
          ]}
        />
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
