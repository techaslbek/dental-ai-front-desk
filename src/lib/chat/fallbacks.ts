import type { PatientLanguage } from "./language";

// Fixed replies the server sends without calling the model.
type Fallback = "technical" | "clinicLimit" | "conversationLimit" | "rateLimited";

const contact = (phone: string | null, lang: PatientLanguage) => {
  if (!phone) return "";
  return { uz: ` Iltimos, ${phone} raqamiga qo‘ng‘iroq qiling.`, "uz-cyrl": ` Илтимос, ${phone} рақамига қўнғироқ қилинг.`, ru: ` Пожалуйста, позвоните по номеру ${phone}.` }[lang];
};

const texts: Record<Fallback, Record<PatientLanguage, string>> = {
  technical: {
    uz: "Kechirasiz, hozir texnik nosozlik bor.",
    "uz-cyrl": "Кечирасиз, ҳозир техник носозлик бор.",
    ru: "Извините, сейчас техническая неполадка.",
  },
  clinicLimit: {
    uz: "Kechirasiz, onlayn yordamchi hozir mavjud emas.",
    "uz-cyrl": "Кечирасиз, онлайн ёрдамчи ҳозир мавжуд эмас.",
    ru: "Извините, онлайн-ассистент сейчас недоступен.",
  },
  conversationLimit: {
    uz: "Bu suhbat juda uzun bo‘lib ketdi. Klinika xodimi sizga yordam beradi.",
    "uz-cyrl": "Бу суҳбат жуда узун бўлиб кетди. Клиника ходими сизга ёрдам беради.",
    ru: "Этот диалог стал слишком длинным. Сотрудник клиники вам поможет.",
  },
  rateLimited: {
    uz: "Juda ko‘p xabar yuborildi. Bir necha daqiqadan so‘ng qayta urinib ko‘ring.",
    "uz-cyrl": "Жуда кўп хабар юборилди. Бир неча дақиқадан сўнг қайта уриниб кўринг.",
    ru: "Слишком много сообщений. Попробуйте ещё раз через несколько минут.",
  },
};

export function fallbackReply(kind: Fallback, lang: PatientLanguage, phone: string | null): string {
  return texts[kind][lang] + (kind === "rateLimited" ? "" : contact(phone, lang));
}
