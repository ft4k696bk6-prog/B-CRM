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
    expect(normalizeRole("manager")).toBe("menadzer");
    expect(normalizeRole("sales")).toBe("handlowiec");
    expect(normalizeRole("accounting")).toBe("ksiegowosc");
    expect(normalizeRole("installer")).toBe("monter");
  });

  it("uses demo account emails as trusted role hints", () => {
    expect(normalizeRole(undefined, "demo-menadzer@example.com")).toBe("menadzer");
    expect(normalizeRole(undefined, "demo-handlowiec@example.com")).toBe("handlowiec");
  });

  it("keeps management operations away from sales users", () => {
    expect(canManageLeads("admin")).toBe(true);
    expect(canManageLeads("menadzer")).toBe(true);
    expect(canManageLeads("handlowiec")).toBe(false);
    expect(canManageUsers("menadzer")).toBe(false);
  });

  it("routes users to role-specific home screens", () => {
    expect(homePathForRole("handlowiec")).toBe("/sales");
    expect(homePathForRole("finance")).toBe("/finance");
    expect(homePathForRole("ksiegowosc")).toBe("/accounting");
    expect(homePathForRole("logistyk")).toBe("/logistics");
    expect(homePathForRole("monter")).toBe("/installation");
    expect(homePathForRole("admin")).toBe("/admin");
  });

  it("limits export and manual lead creation to the expected roles", () => {
    expect(canExportData("finance")).toBe(true);
    expect(canExportData("handlowiec")).toBe(false);
    expect(canCreateManualLead("handlowiec")).toBe(true);
    expect(canCreateManualLead("viewer")).toBe(false);
  });
});
