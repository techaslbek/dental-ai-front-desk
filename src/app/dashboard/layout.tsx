import Link from "next/link";
import { Suspense } from "react";
import { LocaleSwitcher } from "@/components/admin/locale-switcher";
import { getT } from "@/lib/i18n/server";
import { signOut } from "../login/actions";

// Everything under /dashboard depends on the session and the language
// cookie, so it renders at request time inside one Suspense boundary.
export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
      <DashboardChrome>{children}</DashboardChrome>
    </Suspense>
  );
}

async function DashboardChrome({ children }: { children: React.ReactNode }) {
  const { locale, t } = await getT();

  return (
    <div lang={locale} className="flex flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/dashboard" className="text-sm font-semibold tracking-tight text-slate-900">
            Dental AI Front Desk
          </Link>
          <div className="flex items-center gap-3">
            <LocaleSwitcher locale={locale} t={t} />
            <form action={signOut}>
              <button type="submit" className="rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
                {t.common.signOut}
              </button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
