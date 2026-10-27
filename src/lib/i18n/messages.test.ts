import { describe, expect, it } from "vitest";
import { ru } from "./messages/ru";
import { uz } from "./messages/uz";

// The Messages type already forces matching keys; this also catches values
// left empty or pasted untranslated.
function entries(obj: object, prefix = ""): [string, string][] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === "string" ? [[`${prefix}${k}`, v]] : entries(v as object, `${prefix}${k}.`),
  );
}

describe("translations", () => {
  const uzEntries = new Map(entries(uz));
  const ruEntries = new Map(entries(ru));

  it("have the same keys", () => {
    expect([...ruEntries.keys()].sort()).toEqual([...uzEntries.keys()].sort());
  });

  it("have no empty strings", () => {
    for (const [key, value] of [...uzEntries, ...ruEntries]) {
      expect(value.trim(), key).not.toBe("");
    }
  });

  it("Russian text is actually Russian", () => {
    // Language names and brand-like words are the only allowed overlaps.
    const allowedSame = new Set(["common.uzbek", "common.russian", "profile.telegram"]);
    for (const [key, value] of uzEntries) {
      if (allowedSame.has(key)) continue;
      expect(ruEntries.get(key), key).not.toBe(value);
    }
  });
});
