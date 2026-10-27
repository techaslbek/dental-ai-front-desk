import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/form-parts";
import { ResourceForm } from "@/components/admin/resource-form";
import { getClinicContext } from "@/lib/admin/clinic-context";
import { str, type FieldConfig } from "@/lib/admin/fields";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { saveProfile } from "../../actions";

export default async function ProfilePage({ params }: PageProps<"/dashboard/[slug]/profile">) {
  const { slug } = await params;
  const clinic = await getClinicContext(slug);
  if (!clinic) notFound();

  const { t } = await getT();
  const supabase = await createClient();
  const { data: p } = await supabase.from("clinic_profiles").select("*").eq("clinic_id", clinic.id).maybeSingle();

  const isOwner = clinic.role === "owner";
  const half = (name: string, label: string, value: string | null, lang: "uz" | "ru", type: "text" | "textarea", maxLength: number): FieldConfig => ({
    name,
    label,
    type,
    maxLength,
    lang,
    width: "half",
    defaultValue: str(value),
  });

  const fields: FieldConfig[] = [
    {
      name: "name",
      label: t.profile.name,
      type: "text",
      required: true,
      maxLength: 120,
      width: "half",
      defaultValue: clinic.name,
      disabled: !isOwner,
      hint: isOwner ? undefined : t.common.ownerOnly,
    },
    {
      name: "default_locale",
      label: t.profile.defaultLocale,
      type: "select",
      width: "half",
      defaultValue: clinic.defaultLocale,
      disabled: !isOwner,
      options: [
        { value: "uz", label: t.common.uzbek },
        { value: "ru", label: t.common.russian },
      ],
    },
    { name: "phone", label: t.profile.phone, type: "tel", inputMode: "tel", width: "half", placeholder: "+998 90 123 45 67", defaultValue: str(p?.phone) },
    { name: "telegram", label: t.profile.telegram, type: "text", width: "half", placeholder: "@klinika", maxLength: 64, defaultValue: str(p?.telegram) },
    half("address_uz", `${t.profile.address} (${t.common.inUzbek})`, p?.address_uz ?? null, "uz", "text", 300),
    half("address_ru", `${t.profile.address} (${t.common.inRussian})`, p?.address_ru ?? null, "ru", "text", 300),
    { name: "maps_url", label: t.profile.mapsUrl, type: "url", inputMode: "url", hint: t.profile.mapsUrlHint, placeholder: "https://", defaultValue: str(p?.maps_url) },
    half("about_uz", `${t.profile.about} (${t.common.inUzbek})`, p?.about_uz ?? null, "uz", "textarea", 2000),
    half("about_ru", `${t.profile.about} (${t.common.inRussian})`, p?.about_ru ?? null, "ru", "textarea", 2000),
  ];

  return (
    <>
      <PageHeader title={t.profile.title} intro={t.overview.intro} />
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <ResourceForm
          action={saveProfile.bind(null, clinic.slug)}
          fields={fields}
          errorMessages={t.errors}
          labels={{ submit: t.common.save, saving: t.common.saving, saved: t.common.saved }}
        />
      </div>
    </>
  );
}
