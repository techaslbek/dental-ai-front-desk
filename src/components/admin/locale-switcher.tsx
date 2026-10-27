import { setLocale } from "@/app/dashboard/actions";
import type { Messages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/locales";

export function LocaleSwitcher({ locale, t }: { locale: Locale; t: Messages }) {
  const options = [
    { value: "uz", label: t.common.uzbek },
    { value: "ru", label: t.common.russian },
  ] as const;

  return (
    <form action={setLocale} className="flex rounded-md border border-slate-300 bg-white p-0.5" aria-label={t.common.language}>
      {options.map((o) => (
        <button
          key={o.value}
          type="submit"
          name="locale"
          value={o.value}
          aria-pressed={locale === o.value}
          lang={o.value}
          className={`rounded px-2.5 py-1 text-xs font-medium ${
            locale === o.value ? "bg-teal-700 text-white" : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          {o.label}
        </button>
      ))}
    </form>
  );
}
