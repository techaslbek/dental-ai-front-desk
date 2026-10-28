import type { ClinicFacts } from "./facts";

// A made-up clinic used by unit tests and the evaluation suite.
// Not real data. Prices and names are fictional.
export const testFacts: ClinicFacts = {
  clinicId: "00000000-0000-4000-8000-000000000001",
  name: "Smile Test Klinika",
  defaultLocale: "uz",
  phone: "+998 71 200 00 00",
  telegram: "@smile_test_klinika",
  addressUz: "Toshkent, Yunusobod tumani, Amir Temur ko‘chasi 1 (test manzil)",
  addressRu: "Ташкент, Юнусабадский район, ул. Амира Темура 1 (тестовый адрес)",
  mapsUrl: "https://maps.example.com/smile-test",
  aboutUz: "Oilaviy stomatologiya klinikasi. Bolalar ham qabul qilinadi.",
  aboutRu: "Семейная стоматология. Принимаем и детей.",
  hours: {
    mon: [{ open: "09:00", close: "18:00" }],
    tue: [{ open: "09:00", close: "18:00" }],
    wed: [{ open: "09:00", close: "18:00" }],
    thu: [{ open: "09:00", close: "18:00" }],
    fri: [{ open: "09:00", close: "18:00" }],
    sat: [{ open: "09:00", close: "14:00" }],
    sun: [],
  },
  hoursSet: true,
  services: [
    {
      ref: "S1",
      id: "00000000-0000-4000-8000-0000000000a1",
      nameUz: "Professional tish tozalash",
      nameRu: "Профессиональная чистка зубов",
      descriptionUz: null,
      descriptionRu: null,
      priceMin: 250000,
      priceMax: null,
      currency: "UZS",
      durationMinutes: 45,
    },
    {
      ref: "S2",
      id: "00000000-0000-4000-8000-0000000000a2",
      nameUz: "Plomba qo‘yish",
      nameRu: "Установка пломбы",
      descriptionUz: "Kompozit plomba",
      descriptionRu: "Композитная пломба",
      priceMin: 300000,
      priceMax: 550000,
      currency: "UZS",
      durationMinutes: 60,
    },
    {
      ref: "S3",
      id: "00000000-0000-4000-8000-0000000000a3",
      nameUz: "Implant konsultatsiyasi",
      nameRu: "Консультация по имплантации",
      descriptionUz: null,
      descriptionRu: null,
      priceMin: null,
      priceMax: null,
      currency: "UZS",
      durationMinutes: 30,
    },
  ],
  dentists: [
    {
      ref: "D1",
      id: "00000000-0000-4000-8000-0000000000d1",
      fullName: "Dilnoza Karimova",
      specialtyUz: "Terapevt-stomatolog",
      specialtyRu: "Стоматолог-терапевт",
      bioUz: null,
      bioRu: null,
    },
    {
      ref: "D2",
      id: "00000000-0000-4000-8000-0000000000d2",
      fullName: "Rustam Aliyev",
      specialtyUz: "Ortoped, implantolog",
      specialtyRu: "Ортопед, имплантолог",
      bioUz: null,
      bioRu: null,
    },
  ],
  faqs: [
    {
      questionUz: "Parkovka bormi?",
      answerUz: "Ha, klinika oldida bepul parkovka bor.",
      questionRu: "Есть ли парковка?",
      answerRu: "Да, перед клиникой есть бесплатная парковка.",
    },
    {
      questionUz: "Karta orqali to‘lash mumkinmi?",
      answerUz: "Ha, Uzcard, Humo va naqd pul qabul qilinadi.",
      questionRu: "Можно оплатить картой?",
      answerRu: "Да, принимаем Uzcard, Humo и наличные.",
    },
  ],
};

// Wednesday 2026-10-28, 10:30 in Tashkent (05:30 UTC): the clinic is open.
export const testNow = new Date("2026-10-28T05:30:00Z");
