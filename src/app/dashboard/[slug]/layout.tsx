import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NavLinks } from "@/components/admin/nav-links";
import { getClinicContext } from "@/lib/admin/clinic-context";
import { getT } from "@/lib/i18n/server";

// The layout itself stays static; the sidebar reads the session and the URL,
// so it streams in behind its own boundary. Pages get theirs from loading.tsx.
// Without both, client navigations between sections would block.
export default function ClinicLayout({ children, params }: LayoutProps<"/dashboard/[slug]">) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 md:flex-row md:gap-10 md:py-10">
      <aside className="md:w-56 md:shrink-0">
        <Suspense fallback={<div className="h-48 animate-pulse rounded-lg bg-slate-100" aria-busy="true" />}>
          <ClinicSidebar params={params} />
        </Suspense>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}

async function ClinicSidebar({ params }: { params: LayoutProps<"/dashboard/[slug]">["params"] }) {
  const { slug } = await params;
  const clinic = await getClinicContext(slug);
  if (!clinic) notFound();

  const { t } = await getT();
  const base = `/dashboard/${clinic.slug}`;

  return (
    <>
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
    </>
  );
}
