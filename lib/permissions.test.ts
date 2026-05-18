import { describe, expect, it } from "vitest";
import { canEditAnyLead, hasPermission } from "@/lib/permissions";

describe("permission matrix", () => {
  it("allows admins to manage users and import data", () => {
    expect(hasPermission("admin", "users:manage")).toBe(true);
    expect(hasPermission("admin", "data:import")).toBe(true);
  });

  it("keeps sales users scoped to their own leads", () => {
    expect(hasPermission("handlowiec", "leads:view:own")).toBe(true);
    expect(hasPermission("handlowiec", "leads:view:all")).toBe(false);
    expect(canEditAnyLead("handlowiec")).toBe(false);
  });

  it("allows managers to work with team leads without full admin access", () => {
    expect(hasPermission("menadzer", "leads:view:team")).toBe(true);
    expect(hasPermission("menadzer", "leads:edit:team")).toBe(true);
    expect(hasPermission("menadzer", "users:manage")).toBe(false);
  });

  it("keeps viewer role read-only", () => {
    expect(hasPermission("viewer", "dashboard:view:all")).toBe(true);
    expect(hasPermission("viewer", "leads:delete")).toBe(false);
    expect(hasPermission("viewer", "activities:create")).toBe(false);
  });
});
