import { describe, expect, it } from "vitest";
import { isDemoScope, normalizeCrmScope, sameCrmScope } from "@/lib/scope";

describe("CRM data scope helpers", () => {
  it("uses production as the default data scope", () => {
    expect(normalizeCrmScope()).toBe("production");
    expect(normalizeCrmScope("production")).toBe("production");
  });

  it("uses explicit scope only and keeps email addresses neutral", () => {
    expect(normalizeCrmScope("production", "konto@example.com")).toBe("production");
    expect(isDemoScope(normalizeCrmScope(null, "konto@example.com"))).toBe(false);
    expect(isDemoScope(normalizeCrmScope("demo", "konto@example.com"))).toBe(true);
  });

  it("compares scopes through normalized values", () => {
    expect(sameCrmScope("production", null)).toBe(true);
    expect(sameCrmScope("demo", "production")).toBe(false);
  });
});
