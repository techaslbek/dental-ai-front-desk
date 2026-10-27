import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/form-parts";
import { ResourceForm } from "@/components/admin/resource-form";
import { getT } from "@/lib/i18n/server";
import { createClinic } from "../actions";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/admin/page-skeleton";

export const metadata: Metadata = {
  title: "Yangi klinika · Новая клиника",
};

export default function NewClinicPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewClinicPageContent />
    </Suspense>
  );
}

async function NewClinicPageContent() {
  const { locale, t } = await getT();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <PageHeader title={t.onboarding.title} intro={t.onboarding.intro} />
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <ResourceForm
          action={createClinic}
          errorMessages={t.errors}
          labels={{ submit: t.onboarding.submit, saving: t.common.saving, saved: t.common.saved, cancel: t.common.cancel }}
          cancelHref="/dashboard"
          fields={[
            { name: "name", label: t.onboarding.name, type: "text", required: true, maxLength: 120 },
            {
              name: "slug",
              label: t.onboarding.slug,
              type: "text",
              required: true,
              maxLength: 48,
              placeholder: "smile-dental",
              hint: t.onboarding.slugHint,
            },
            {
              name: "default_locale",
              label: t.onboarding.defaultLocale,
              type: "select",
              defaultValue: locale,
              options: [
                { value: "uz", label: t.common.uzbek },
                { value: "ru", label: t.common.russian },
              ],
            },
          ]}
        />
      </div>
    </main>
  );
}
