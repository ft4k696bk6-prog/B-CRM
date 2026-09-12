import { describe, expect, it } from "vitest";
import type { ContractRecord } from "@/lib/contracts";
import { buildContractStats, canManageContractWorkflow, needsInstallation, needsScheduling, publicContract, signingMonth, summarizeContracts, validateWorkflowCommand } from "@/lib/contract-workflow";

const all = { month: "", team: "", salesperson: "" };
function contract(overrides: Partial<ContractRecord> = {}): ContractRecord {
  return {
    id: "contract-1", created_by: "seller", signed_at: "2026-09-12T00:00:00Z",
    submission_status: "submitted", gross_amount: 45000, archived_at: null, archive_reason: null,
    creator: { id: "seller", full_name: "Handlowiec", email: null, manager_id: "manager" },
    workflow: { contract_id: "contract-1", verified: true, equipment_ordered: false, installation_scheduled: false, pge_submitted: false, settled: false, archived_at: null, archive_reason: null, version: 0, updated_at: "2026-09-12T12:00:00Z" },
    ...overrides,
  } as ContractRecord;
}

describe("contract statistics", () => {
  it("attributes later settlement and resignation to the signing month and excludes cancelled revenue", () => {
    const paid = contract({ archived_at: "2026-10-12T12:00:00Z", archive_reason: "settled" });
    paid.workflow!.settled = true;
    const resigned = contract({ id: "resigned", gross_amount: 80000, archived_at: "2026-11-01T12:00:00Z", archive_reason: "resigned" });
    resigned.workflow!.settled = true;
    const stats = buildContractStats([paid, resigned, contract({ submission_status: "draft", gross_amount: 900000 })]);
    expect(summarizeContracts(stats, { ...all, month: "2026-09" })).toMatchObject({ signed: 2, settled: 1, resigned: 1, grossAmount: 45000, toInstall: 0 });
    expect(summarizeContracts(stats, { ...all, month: "2026-10" }).signed).toBe(0);
  });

  it("counts all verified current unpaid contracts independently of equipment or appointments", () => {
    const item = contract();
    expect(needsInstallation(item)).toBe(true);
    expect(needsScheduling(item)).toBe(true);
    item.workflow!.equipment_ordered = true;
    item.workflow!.installation_scheduled = true;
    item.installation_at = "2026-09-01T08:00:00Z";
    expect(needsInstallation(item)).toBe(true); // No invented completion event from a past date.
    expect(needsScheduling(item)).toBe(false);
    item.workflow!.settled = true;
    expect(needsInstallation(item)).toBe(false);
    item.workflow!.settled = false; item.workflow!.verified = false;
    expect(needsInstallation(item)).toBe(false);
  });

  it("filters person and team totals without mixing another team", () => {
    const one = contract();
    const two = contract({ id: "two", created_by: "other", creator: null, gross_amount: 1000 });
    const stats = buildContractStats([one, two]);
    expect(summarizeContracts(stats, all).grossAmount).toBe(46000);
    expect(summarizeContracts(stats, { ...all, team: "manager" }).grossAmount).toBe(45000);
    expect(summarizeContracts(stats, { ...all, salesperson: "other" }).grossAmount).toBe(1000);
  });

  it("reports incomplete amounts and never invents signing dates", () => {
    expect(signingMonth("2026-08-31T22:30:00Z")).toBe("2026-09");
    expect(signingMonth(null)).toBe("unknown");
    const stats = summarizeContracts(buildContractStats([contract({ gross_amount: 0 }), contract({ gross_amount: Number.NaN })]), all);
    expect(stats).toMatchObject({ missingAmount: 2, grossAmount: 0, signed: 2 });
  });
});

describe("private workflow", () => {
  it.each(["menadzer", "handlowiec", "finance", "viewer", "ksiegowosc", "logistyk", "monter"])("does not disclose internal checkboxes to %s", (role) => {
    const original = contract({ equipment_ordered: true, installation_scheduled: true, installation_at: "2026-09-22T08:00:00Z", tasks: [], process_note: "internal", management_notes: [], commission_amount: 1234 });
    const result = publicContract(original, role);
    expect(canManageContractWorkflow(role)).toBe(false);
    for (const key of ["workflow", "tasks", "process_note", "management_notes", "commission_amount"]) expect(result).not.toHaveProperty(key);
    expect(result.equipment_ordered).toBe(true);
    expect(result.installation_at).toBe(original.installation_at);
    expect(original.workflow).toBeDefined();
  });
  it.each(["owner", "admin"])("retains workflow for %s", (role) => {
    expect(canManageContractWorkflow(role)).toBe(true);
    expect(publicContract(contract(), role).workflow).toBeDefined();
  });
  it("requires a valid date when scheduling and a version on every mutation", () => {
    const command = { action: "workflow", field: "installation_scheduled", value: true, expected_version: 1 };
    expect(validateWorkflowCommand(command)).not.toBeNull();
    expect(validateWorkflowCommand({ ...command, installation_at: "not-a-date" })).not.toBeNull();
    expect(validateWorkflowCommand({ ...command, installation_at: "2026-09-22T08:00:00Z" })).toBeNull();
    expect(validateWorkflowCommand({ ...command, value: false })).toBeNull();
    expect(validateWorkflowCommand({ action: "restore" })).not.toBeNull();
  });
});
