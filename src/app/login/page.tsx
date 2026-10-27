import type { Metadata } from "next";
import { Suspense } from "react";
import { signIn } from "./actions";

export const metadata: Metadata = {
  title: "Kirish · Вход",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Xodimlar uchun kirish
        </h1>
        <p className="mt-1 text-sm text-slate-500">Вход для сотрудников клиники</p>

        <Suspense>
          <LoginError searchParams={searchParams} />
        </Suspense>

        <form action={signIn} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Parol · Пароль
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              maxLength={128}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
          >
            Kirish · Войти
          </button>
        </form>

        <p className="mt-6 text-xs text-slate-500">
          Hisobni klinika administratori yaratadi. · Аккаунт создаёт администратор клиники.
        </p>
      </div>
    </main>
  );
}

async function LoginError({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { error } = await searchParams;
  if (!error) return null;
  return (
    <p
      role="alert"
      className="mt-6 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
    >
      Email yoki parol noto‘g‘ri. · Неверный email или пароль.
    </p>
  );
}
