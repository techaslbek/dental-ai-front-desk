import { ru } from "./messages/ru";
import { uz, type Messages } from "./messages/uz";
import type { Locale } from "./locales";

export type { Messages };
export type ErrorKey = keyof Messages["errors"];

const dictionaries: Record<Locale, Messages> = { uz, ru };

export function getMessages(locale: Locale): Messages {
  return dictionaries[locale];
}
