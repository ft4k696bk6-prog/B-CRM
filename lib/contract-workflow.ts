import type { ContractRecord } from "@/lib/contracts";

export const WORKFLOW_CHECKBOXES = [
  ["verified", "Dział weryfikacji"],
  ["equipment_ordered", "Sprzęt zamówiony"],
  ["installation_scheduled", "Montaż umówiony"],
  ["pge_submitted", "Zgłoszenie PGE"],
  ["settled", "Rozliczona"],
] as const;

export type WorkflowField = (typeof WORKFLOW_CHECKBOXES)[number][0];
export type ArchiveReason = "settled" | "resigned";
export type ContractWorkflow = Record<WorkflowField, boolean> & {
  contract_id: string;
  archived_at: string | null;
  archive_reason: ArchiveReason | null;
  version: number;
  updated_at: string;
};

export type ContractFilters = { month: string; team: string; salesperson: string };
export type ContractStats = {
  signed: number;
  toInstall: number;
  settled: number;
  resigned: number;
  grossAmount: number;
  missingAmount: number;
};
export type ContractStatsBucket = ContractStats & {
  month: string;
  salesperson: string;
  team: string;
};

export function canManageContractWorkflow(role: string) {
  return role === "owner" || role === "admin";
}

export function signingMonth(signedAt?: string | null) {
  if (!signedAt || Number.isNaN(Date.parse(signedAt))) return "unknown";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit",
  }).formatToParts(new Date(signedAt));
  return `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}`;
}

export function monthLabel(month: string) {
  if (month === "unknown") return "Bez daty podpisania";
  return new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${month}-01T12:00:00Z`));
}

export function isArchived(contract: Pick<ContractRecord, "archived_at">) {
  return Boolean(contract.archived_at);
}

export function needsInstallation(contract: ContractRecord) {
  return contract.submission_status === "submitted" && !isArchived(contract) &&
    contract.workflow?.verified === true && !contract.workflow.settled;
}

export function needsScheduling(contract: ContractRecord) {
  return needsInstallation(contract) && !contract.workflow?.installation_scheduled;
}

export function emptyContractStats(): ContractStats {
  return { signed: 0, toInstall: 0, settled: 0, resigned: 0, grossAmount: 0, missingAmount: 0 };
}

// Statistics are computed before private workflow fields are removed from the API response.
// Every outcome belongs to the signing month, including later resignations/settlements.
export function buildContractStats(contracts: ContractRecord[]): ContractStatsBucket[] {
  const buckets = new Map<string, ContractStatsBucket>();
  for (const contract of contracts) {
    if (contract.submission_status !== "submitted") continue;
    const dimensions = {
      month: signingMonth(contract.signed_at),
      salesperson: contract.created_by || "unassigned",
      team: contract.creator?.manager_id || contract.created_by || "unassigned",
    };
    const key = JSON.stringify(dimensions);
    const bucket = buckets.get(key) || { ...emptyContractStats(), ...dimensions };
    bucket.signed++;
    if (contract.archive_reason === "resigned") {
      bucket.resigned++;
    } else {
      const amount = Number(contract.gross_amount);
      if (Number.isFinite(amount) && amount > 0) bucket.grossAmount += Math.round(amount * 100) / 100;
      else bucket.missingAmount++;
      if (contract.workflow?.settled) bucket.settled++;
      if (needsInstallation(contract)) bucket.toInstall++;
    }
    buckets.set(key, bucket);
  }
  return [...buckets.values()];
}

export function matchesDimensions(
  item: { month: string; team: string; salesperson: string }, filters: ContractFilters,
) {
  return (!filters.month || item.month === filters.month) &&
    (!filters.team || item.team === filters.team || item.salesperson === filters.team) &&
    (!filters.salesperson || item.salesperson === filters.salesperson);
}

export function matchesContractFilters(contract: ContractRecord, filters: ContractFilters) {
  return matchesDimensions({
    month: signingMonth(contract.signed_at),
    team: contract.creator?.manager_id || contract.created_by || "unassigned",
    salesperson: contract.created_by || "unassigned",
  }, filters);
}

export function summarizeContracts(buckets: ContractStatsBucket[], filters: ContractFilters): ContractStats {
  const result = emptyContractStats();
  for (const bucket of buckets.filter((item) => matchesDimensions(item, filters))) {
    for (const key of Object.keys(result) as Array<keyof ContractStats>) result[key] += bucket[key];
  }
  result.grossAmount = Math.round(result.grossAmount * 100) / 100;
  return result;
}

export function publicContract(contract: ContractRecord, role: string): ContractRecord {
  if (canManageContractWorkflow(role)) return contract;
  const result = { ...contract };
  delete result.workflow;
  delete result.tasks;
  delete result.process_note;
  delete result.management_notes;
  delete result.resignation_note;
  delete result.commission_margin_net;
  delete result.commission_percent;
  delete result.commission_amount;
  // Old snapshots/metadata must not disclose the internal verification or PGE state.
  delete (result as unknown as Record<string, unknown>).metadata;
  result.process_status = contract.archive_reason === "resigned" ? "resigned"
    : contract.archive_reason === "settled" ? "settled"
    : contract.submission_status === "draft" ? "incomplete"
    : contract.installation_scheduled ? "installation_scheduled" : "verification";
  return result;
}

export function validateWorkflowCommand(body: Record<string, unknown>): string | null {
  if (!["workflow", "archive", "restore"].includes(String(body.action))) return "Niepoprawna operacja.";
  if (!Number.isSafeInteger(body.expected_version) || Number(body.expected_version) < 0)
    return "Odśwież umowę przed zapisaniem zmiany.";
  if (body.action === "archive" && !["settled", "resigned"].includes(String(body.reason)))
    return "Wybierz powód archiwizacji.";
  if (body.action !== "workflow") return null;
  if (!WORKFLOW_CHECKBOXES.some(([field]) => field === body.field) || typeof body.value !== "boolean")
    return "Niepoprawne oznaczenie umowy.";
  if (body.field === "installation_scheduled" && body.value === true &&
      (typeof body.installation_at !== "string" || !body.installation_at || Number.isNaN(Date.parse(body.installation_at))))
    return "Podaj prawidłowy termin montażu.";
  return null;
}
