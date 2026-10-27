import "server-only";
import { cookies } from "next/headers";
import { getMessages } from ".";
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "./locales";

// The staff UI language comes from a cookie set by the language switcher.
export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : defaultLocale;
}

export async function getT() {
  const locale = await getLocale();
  return { locale, t: getMessages(locale) };
}
