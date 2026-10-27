import { describe, expect, it, vi } from "vitest";

// env.ts parses process.env on import; give it valid values so the module loads.
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");

const { parsePublicEnv } = await import("./env");

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abc",
};

describe("parsePublicEnv", () => {
  it("accepts a publishable key and https URL", () => {
    expect(parsePublicEnv(valid)).toEqual(valid);
  });

  it("rejects a secret key in a public variable", () => {
    expect(() =>
      parsePublicEnv({ ...valid, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_abc" }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  });

  it("rejects a non-https URL", () => {
    expect(() =>
      parsePublicEnv({ ...valid, NEXT_PUBLIC_SUPABASE_URL: "http://example.supabase.co" }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("names missing variables without leaking values", () => {
    const secretLooking = "sb_secret_do_not_print";
    let message = "";
    try {
      parsePublicEnv({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: secretLooking });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(message).not.toContain(secretLooking);
  });
});
