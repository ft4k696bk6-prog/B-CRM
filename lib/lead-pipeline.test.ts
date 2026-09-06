import { describe, expect, it } from "vitest";
import { groupLeadsByStatus, LEAD_PIPELINE_STATUSES } from "./lead-pipeline";
import type { Lead } from "./types";

function lead(id: string, status: Lead["status"]): Lead {
  return {
    id,
    full_name: `Lead ${id}`,
    postal_code: null,
    phone: "600123456",
    address: null,
    voivodeship: null,
    county: null,
    status,
    assigned_to: null,
    created_at: "2026-09-06T10:00:00.000Z",
    updated_at: "2026-09-06T10:00:00.000Z",
    last_opened_at: null,
    source: null,
    resignation_reason: null,
    callback_at: null,
    meeting_at: null,
    meeting_address: null,
    meeting_note: null,
    contract_number: null,
    crm_environment: "production"
  };
}

describe("lead pipeline", () => {
  it("keeps the intended sales-funnel status order", () => {
    expect(LEAD_PIPELINE_STATUSES).toEqual([
      "Nowy",
      "Nie odebrał",
      "Call back",
      "Spotkanie",
      "Po spotkaniu",
      "Umowa",
      "Rezygnacja"
    ]);
  });

  it("groups every lead into its status column", () => {
    const groups = groupLeadsByStatus([
      lead("1", "Nowy"),
      lead("2", "Call back"),
      lead("3", "Nowy"),
      lead("4", "Umowa")
    ]);

    expect(groups.find((group) => group.status === "Nowy")?.leads.map((item) => item.id)).toEqual(["1", "3"]);
    expect(groups.find((group) => group.status === "Call back")?.leads.map((item) => item.id)).toEqual(["2"]);
    expect(groups.find((group) => group.status === "Umowa")?.leads.map((item) => item.id)).toEqual(["4"]);
  });
});
