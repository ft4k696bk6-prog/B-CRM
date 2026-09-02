import { describe, expect, it } from "vitest";
import { canAccessAssignedLead } from "@/lib/lead-access";

describe("lead role scope", () => {
  const team = new Set(["manager", "seller"]);

  it("limits salesperson to own leads", () => {
    expect(canAccessAssignedLead({ role: "handlowiec", profileId: "seller", assignedTo: "seller" })).toBe(true);
    expect(canAccessAssignedLead({ role: "handlowiec", profileId: "seller", assignedTo: null })).toBe(false);
    expect(canAccessAssignedLead({ role: "handlowiec", profileId: "seller", assignedTo: "other" })).toBe(false);
  });

  it("lets manager see unassigned and team leads, but not another team", () => {
    expect(canAccessAssignedLead({ role: "menadzer", profileId: "manager", assignedTo: null, managerTeamIds: team })).toBe(true);
    expect(canAccessAssignedLead({ role: "menadzer", profileId: "manager", assignedTo: "seller", managerTeamIds: team })).toBe(true);
    expect(canAccessAssignedLead({ role: "menadzer", profileId: "manager", assignedTo: "other", managerTeamIds: team })).toBe(false);
  });

  it.each(["owner", "admin"])("gives %s the full environment scope", (role) => {
    expect(canAccessAssignedLead({ role, profileId: role, assignedTo: "other" })).toBe(true);
  });
});
