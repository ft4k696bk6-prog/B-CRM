import { describe, expect, it } from "vitest";
import { endOfDay, escapeCsv, needsNextAction, startOfDay } from "@/lib/admin-leads";

describe("admin lead helpers", () => {
  it("normalizes date filters to full-day ISO bounds", () => {
    expect(startOfDay("2026-05-18")).toBe("2026-05-18T00:00:00.000Z");
    expect(endOfDay("2026-05-18")).toBe("2026-05-18T23:59:59.999Z");
  });

  it("detects leads that still need a next action", () => {
    expect(needsNextAction({ status: "Nowy", callback_at: null, meeting_at: null })).toBe(true);
    expect(needsNextAction({ status: "Call back", callback_at: "2026-05-19", meeting_at: null })).toBe(false);
    expect(needsNextAction({ status: "Umowa", callback_at: null, meeting_at: null })).toBe(false);
  });

  it("escapes CSV values safely", () => {
    expect(escapeCsv('ACME "Lead"')).toBe('"ACME ""Lead"""');
    expect(escapeCsv(null)).toBe('""');
  });
});
