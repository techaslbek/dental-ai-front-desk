import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/form-parts";
import { ResourceForm } from "@/components/admin/resource-form";
import { getClinicContext } from "@/lib/admin/clinic-context";
import { isResourceKey, resources } from "@/lib/admin/resources";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { saveResource } from "../../../actions";

export default async function NewResourcePage({ params }: PageProps<"/dashboard/[slug]/[resource]/new">) {
  const { slug, resource } = await params;
  if (!isResourceKey(resource)) notFound();
  const clinic = await getClinicContext(slug);
  if (!clinic) notFound();

  const { t } = await getT();
  const definition = resources[resource];
  const fields = await definition.form(await createClient(), clinic.id, null, t);
  if (!fields) notFound();

  return (
    <>
      <PageHeader title={definition.titles(t).create} intro={resource === "faqs" ? t.faqs.hint : undefined} />
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <ResourceForm
          action={saveResource.bind(null, resource, clinic.slug, null)}
          fields={fields}
          errorMessages={t.errors}
          labels={{ submit: t.common.add, saving: t.common.saving, saved: t.common.saved, cancel: t.common.cancel }}
          cancelHref={`/dashboard/${clinic.slug}/${resource}`}
        />
      </div>
    </>
  );
}
