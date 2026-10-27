import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="max-w-xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Dental AI Front Desk
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          Stomatologiya klinikalari uchun sun’iy intellektli administrator.
        </p>
        <p className="mt-1 text-slate-500">
          ИИ-администратор для стоматологических клиник.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-block rounded-md bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
        >
          Xodimlar uchun kirish · Вход для сотрудников
        </Link>
      </div>
    </main>
  );
}
