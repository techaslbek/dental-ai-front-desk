import { describe, expect, it } from "vitest";
import { formatAmount, formatPriceRange } from "./format";
import { ru } from "./i18n/messages/ru";
import { uz } from "./i18n/messages/uz";

const tUz = { ...uz.common, ...uz.services };
const tRu = { ...ru.common, ...ru.services };

describe("formatAmount", () => {
  it("groups thousands with spaces", () => {
    expect(formatAmount(0)).toBe("0");
    expect(formatAmount(250000)).toBe("250 000");
    expect(formatAmount(1200000)).toBe("1 200 000");
  });
});

describe("formatPriceRange", () => {
  it("formats ranges, single prices and missing prices per language", () => {
    expect(formatPriceRange(200000, 300000, "UZS", tUz)).toBe("200 000 – 300 000 so‘m");
    expect(formatPriceRange(200000, null, "UZS", tRu)).toBe("200 000 сум");
    expect(formatPriceRange(200000, 200000, "UZS", tRu)).toBe("200 000 сум");
    expect(formatPriceRange(null, null, "UZS", tUz)).toBe(uz.services.priceOnRequest);
    expect(formatPriceRange(null, 50, "USD", tRu)).toBe("≤ 50 USD");
  });
});
