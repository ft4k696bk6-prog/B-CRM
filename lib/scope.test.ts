import { describe, expect, it } from "vitest";
import { isDemoScope, normalizeCrmScope, sameCrmScope } from "@/lib/scope";

describe("CRM data scope helpers", () => {
  it("uses production as the default data scope", () => {
    expect(normalizeCrmScope()).toBe("production");
    expect(normalizeCrmScope("production")).toBe("production");
  });

  it("treats known demo emails as demo scope", () => {
    expect(normalizeCrmScope("production", "demo@example.com")).toBe("demo");
    expect(isDemoScope(normalizeCrmScope(null, "demo-handlowiec@example.com"))).toBe(true);
  });

  it("compares scopes through normalized values", () => {
    expect(sameCrmScope("production", null)).toBe(true);
    expect(sameCrmScope("demo", "production")).toBe(false);
  });
});
