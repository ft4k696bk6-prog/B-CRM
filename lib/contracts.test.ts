import { describe, expect, it } from "vitest";
import { canViewContractForRole, contractDisplayStatus } from "@/lib/contracts";

describe("contract visibility", () => {
  const base = { profileId: "user", createdBy: "seller", creatorManagerId: "manager", submissionStatus: "draft" as const };

  it("lets a salesperson see only own drafts and submitted contracts", () => {
    expect(canViewContractForRole({ ...base, role: "handlowiec", profileId: "seller" })).toBe(true);
    expect(canViewContractForRole({ ...base, role: "handlowiec" })).toBe(false);
  });

  it("hides drafts from managers and exposes submitted team contracts", () => {
    expect(canViewContractForRole({ ...base, role: "menadzer", profileId: "manager" })).toBe(false);
    expect(canViewContractForRole({ ...base, role: "menadzer", profileId: "manager", submissionStatus: "submitted" })).toBe(true);
    expect(canViewContractForRole({ ...base, role: "menadzer", profileId: "other", submissionStatus: "submitted" })).toBe(false);
  });

  it("lets owner and admin see all contracts", () => {
    expect(canViewContractForRole({ ...base, role: "owner" })).toBe(true);
    expect(canViewContractForRole({ ...base, role: "admin" })).toBe(true);
  });

  it("shows draft separately from process status", () => {
    expect(contractDisplayStatus({ submission_status: "draft", process_status: "incomplete" })).toBe("Wersja robocza");
    expect(contractDisplayStatus({ submission_status: "submitted", process_status: "settled" })).toBe("Rozliczone");
  });
});
