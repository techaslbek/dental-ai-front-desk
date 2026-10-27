import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteButton } from "@/components/admin/delete-button";
import { PageHeader } from "@/components/admin/form-parts";
import { getClinicContext } from "@/lib/admin/clinic-context";
import { isResourceKey, resources } from "@/lib/admin/resources";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { deleteResource } from "../../actions";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/admin/page-skeleton";

export default function ResourceListPage(props: PageProps<"/dashboard/[slug]/[resource]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ResourceListPageContent {...props} />
    </Suspense>
  );
}

async function ResourceListPageContent({ params }: PageProps<"/dashboard/[slug]/[resource]">) {
  const { slug, resource } = await params;
  if (!isResourceKey(resource)) notFound();
  const clinic = await getClinicContext(slug);
  if (!clinic) notFound();

  const { locale, t } = await getT();
  const supabase = await createClient();
  const definition = resources[resource];
  const titles = definition.titles(t);
  const items = await definition.list(supabase, clinic.id, t, locale);
  const base = `/dashboard/${clinic.slug}/${resource}`;

  return (
    <>
      <PageHeader
        title={titles.list}
        intro={t.overview.intro}
        action={
          <Link href={`${base}/new`} className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
            {titles.create}
          </Link>
        }
      />

      {items === null ? (
        <p role="alert" className="text-sm text-red-700">
          {t.dashboard.loadFailed}
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-600">
          {t.common.empty}
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium text-slate-900">
                  <span className="break-words">{item.primary}</span>
                  {!item.isActive ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {t.common.inactive}
                    </span>
                  ) : null}
                </p>
                {item.secondary ? <p className="text-sm text-slate-500">{item.secondary}</p> : null}
                {item.meta ? <p className="mt-0.5 text-sm text-slate-600">{item.meta}</p> : null}
              </div>
              <div className="flex items-center gap-1">
                <Link
                  href={`${base}/${item.id}`}
                  aria-label={`${t.common.edit}: ${item.primary}`}
                  className="rounded-md px-2.5 py-1.5 text-sm font-medium text-teal-800 hover:bg-teal-50"
                >
                  {t.common.edit}
                </Link>
                <DeleteButton
                  action={deleteResource.bind(null, resource, clinic.slug, item.id)}
                  label={t.common.delete}
                  confirmMessage={t.common.confirmDelete}
                  errorMessage={t.errors.generic}
                  itemName={item.primary}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
