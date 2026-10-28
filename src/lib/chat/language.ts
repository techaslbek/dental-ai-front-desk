// Which language/script a patient wrote in. The model handles this itself;
// this is for the few fixed replies the server sends without the model.
export type PatientLanguage = "uz" | "uz-cyrl" | "ru";

const UZBEK_CYRILLIC_LETTERS = /[ўқғҳЎҚҒҲ]/;
const CYRILLIC = /[Ѐ-ӿ]/g;
const LATIN = /[A-Za-z]/g;
// Common Uzbek words written in Cyrillic without the distinctive letters.
const UZBEK_CYRILLIC_WORDS = /(^|\s)(салом|рахмат|раҳмат|канча|қанча|керак|борми|йўқ|ха|ҳа|бугун|эртага|тиш)(\s|[?!.,]|$)/i;

export function detectLanguage(text: string, fallback: "uz" | "ru"): PatientLanguage {
  const cyrillic = text.match(CYRILLIC)?.length ?? 0;
  const latin = text.match(LATIN)?.length ?? 0;
  if (cyrillic === 0 && latin === 0) return fallback;
  if (cyrillic > latin) {
    return UZBEK_CYRILLIC_LETTERS.test(text) || UZBEK_CYRILLIC_WORDS.test(text) ? "uz-cyrl" : "ru";
  }
  return "uz";
}

// conversations.locale stores the UI language family only.
export const localeFamily = (lang: PatientLanguage): "uz" | "ru" => (lang === "ru" ? "ru" : "uz");
