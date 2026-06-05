import { describe, expect, it } from "vitest";
import {
  canCreateManualLead,
  canExportData,
  canManageLeads,
  canManageUsers,
  homePathForRole,
  normalizeRole,
} from "@/lib/roles";

describe("role helpers", () => {
  it("maps legacy role names to current role names", () => {
    expect(normalizeRole("manager")).toBe("kierownik");
    expect(normalizeRole("sales")).toBe("handlowiec");
    expect(normalizeRole("accounting")).toBe("ksiegowosc");
    expect(normalizeRole("installer")).toBe("monter");
  });

  it("uses stored and trusted auth roles instead of email aliases", () => {
    expect(normalizeRole(undefined, "kierownik@example.com", "manager")).toBe("kierownik");
    expect(normalizeRole(undefined, "handlowiec@example.com", "sales")).toBe("handlowiec");
  });

  it("keeps management operations away from sales users", () => {
    expect(canManageLeads("admin")).toBe(true);
    expect(canManageLeads("kierownik")).toBe(true);
    expect(canManageLeads("handlowiec")).toBe(false);
    expect(canManageUsers("kierownik")).toBe(false);
  });

  it("routes users to role-specific home screens", () => {
    expect(homePathForRole("handlowiec")).toBe("/sales");
    expect(homePathForRole("finance")).toBe("/admin");
    expect(homePathForRole("ksiegowosc")).toBe("/admin");
    expect(homePathForRole("logistyk")).toBe("/admin");
    expect(homePathForRole("monter")).toBe("/admin");
    expect(homePathForRole("admin")).toBe("/admin");
  });

  it("limits export and manual lead creation to the expected roles", () => {
    expect(canExportData("finance")).toBe(true);
    expect(canExportData("handlowiec")).toBe(false);
    expect(canCreateManualLead("handlowiec")).toBe(true);
    expect(canCreateManualLead("viewer")).toBe(false);
  });
});
