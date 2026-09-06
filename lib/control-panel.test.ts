import { describe, expect, it } from "vitest";

function validRoutingTotal(assignments: Array<{ profileId: string; weight: number }>) {
  if (!assignments.length) return true;
  if (new Set(assignments.map((item) => item.profileId)).size !== assignments.length) return false;
  if (assignments.some((item) => !item.profileId || !Number.isInteger(item.weight) || item.weight < 1 || item.weight > 100)) return false;
  return assignments.reduce((sum, item) => sum + item.weight, 0) === 100;
}

describe("control panel routing rules", () => {
  it("accepts one salesperson at 100 percent", () => {
    expect(validRoutingTotal([{ profileId: "a", weight: 100 }])).toBe(true);
  });

  it("accepts weighted split that sums to 100", () => {
    expect(validRoutingTotal([
      { profileId: "a", weight: 50 },
      { profileId: "b", weight: 30 },
      { profileId: "c", weight: 20 }
    ])).toBe(true);
  });

  it("rejects an incomplete percentage split", () => {
    expect(validRoutingTotal([
      { profileId: "a", weight: 60 },
      { profileId: "b", weight: 30 }
    ])).toBe(false);
  });

  it("rejects duplicate salesperson entries", () => {
    expect(validRoutingTotal([
      { profileId: "a", weight: 50 },
      { profileId: "a", weight: 50 }
    ])).toBe(false);
  });

  it("allows clearing routing", () => {
    expect(validRoutingTotal([])).toBe(true);
  });
});
