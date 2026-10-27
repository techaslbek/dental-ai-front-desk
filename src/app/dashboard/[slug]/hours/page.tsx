import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/form-parts";
import { HoursForm } from "@/components/admin/hours-form";
import { getClinicContext } from "@/lib/admin/clinic-context";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { readOpeningHours } from "@/lib/validation/clinic";
import { saveHours } from "../../actions";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/admin/page-skeleton";

export default function HoursPage(props: PageProps<"/dashboard/[slug]/hours">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <HoursPageContent {...props} />
    </Suspense>
  );
}

async function HoursPageContent({ params }: PageProps<"/dashboard/[slug]/hours">) {
  const { slug } = await params;
  const clinic = await getClinicContext(slug);
  if (!clinic) notFound();

  const { t } = await getT();
  const supabase = await createClient();
  const { data } = await supabase.from("clinic_profiles").select("opening_hours").eq("clinic_id", clinic.id).maybeSingle();
  const hours = readOpeningHours(data?.opening_hours);
  const isSet = Object.values(hours).some((d) => d.length > 0);

  return (
    <>
      <PageHeader title={t.hours.title} intro={t.hours.intro} />
      <HoursForm
        action={saveHours.bind(null, clinic.slug)}
        hours={hours}
        isSet={isSet}
        errorMessages={t.errors}
        labels={{
          days: t.hours.days,
          closed: t.hours.closed,
          open: t.hours.open,
          close: t.hours.close,
          submit: t.common.save,
          saving: t.common.saving,
          saved: t.common.saved,
        }}
      />
    </>
  );
}
