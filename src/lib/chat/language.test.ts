import { describe, expect, it } from "vitest";
import { fallbackReply } from "./fallbacks";
import { detectLanguage } from "./language";

describe("detectLanguage", () => {
  it.each([
    ["Salom, tish tozalash qancha turadi?", "uz"],
    ["Здравствуйте, сколько стоит чистка?", "ru"],
    ["Салом, тиш тозалаш қанча туради?", "uz-cyrl"],
    ["Салом, эртага келсам буладими", "uz-cyrl"],
    ["Добрый день! Есть парковка?", "ru"],
    ["+998901112233", "ru"],
  ])("%s -> %s", (text, expected) => {
    expect(detectLanguage(text, "ru")).toBe(expected);
  });
});

describe("fallbackReply", () => {
  it("adds the clinic phone except for rate limits", () => {
    expect(fallbackReply("technical", "ru", "+998 71 200 00 00")).toContain("+998 71 200 00 00");
    expect(fallbackReply("rateLimited", "uz", "+998 71 200 00 00")).not.toContain("+998");
    expect(fallbackReply("technical", "uz-cyrl", null)).toBe("Кечирасиз, ҳозир техник носозлик бор.");
  });
});
