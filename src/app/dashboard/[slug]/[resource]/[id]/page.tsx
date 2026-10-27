import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/admin/form-parts";
import { ResourceForm } from "@/components/admin/resource-form";
import { getClinicContext } from "@/lib/admin/clinic-context";
import { isResourceKey, resources } from "@/lib/admin/resources";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { saveResource } from "../../../actions";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/admin/page-skeleton";

export default function EditResourcePage(props: PageProps<"/dashboard/[slug]/[resource]/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EditResourcePageContent {...props} />
    </Suspense>
  );
}

async function EditResourcePageContent({ params }: PageProps<"/dashboard/[slug]/[resource]/[id]">) {
  const { slug, resource, id } = await params;
  if (!isResourceKey(resource) || !z.uuid().safeParse(id).success) notFound();
  const clinic = await getClinicContext(slug);
  if (!clinic) notFound();

  const { t } = await getT();
  const definition = resources[resource];
  const fields = await definition.form(await createClient(), clinic.id, id, t);
  if (!fields) notFound();

  return (
    <>
      <PageHeader title={definition.titles(t).edit} intro={resource === "faqs" ? t.faqs.hint : undefined} />
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <ResourceForm
          action={saveResource.bind(null, resource, clinic.slug, id)}
          fields={fields}
          errorMessages={t.errors}
          labels={{ submit: t.common.save, saving: t.common.saving, saved: t.common.saved, cancel: t.common.cancel }}
          cancelHref={`/dashboard/${clinic.slug}/${resource}`}
        />
      </div>
    </>
  );
}
