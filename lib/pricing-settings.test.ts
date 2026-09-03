import { describe, expect, it } from "vitest";
import { canManagePricing } from "@/lib/pricing-access";

describe("pricing settings access", () => {
  it.each(["owner", "admin"])("allows %s", (role) => {
    expect(canManagePricing(role)).toBe(true);
  });

  it.each(["menadzer", "handlowiec", "ksiegowosc", "logistyk", "monter"])("denies %s", (role) => {
    expect(canManagePricing(role)).toBe(false);
  });
});
