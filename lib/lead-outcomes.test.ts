import { describe, expect, it } from "vitest";
import { allowedOutcomes, isMandatoryLead, validateLeadOutcome } from "@/lib/lead-outcomes";

describe("lead outcomes", () => {
  const now = new Date("2026-09-02T10:00:00.000Z");

  it("offers fast sales actions before and after a meeting", () => {
    expect(allowedOutcomes("Nowy")).toEqual(["callback", "meeting", "no_answer", "resignation", "return"]);
    expect(allowedOutcomes("Spotkanie", "2026-09-02T09:00:00.000Z", now)).toEqual(["contract", "resignation", "callback", "return"]);
    expect(allowedOutcomes("Spotkanie", "2026-09-02T11:00:00.000Z", now)).toEqual(["callback", "meeting", "no_answer", "resignation", "return"]);
  });

  it("validates future dates and required notes", () => {
    expect(validateLeadOutcome("Nowy", "callback", { callbackAt: "2026-09-02T09:00:00.000Z" }, now)).toMatch(/przyszłą/);
    expect(validateLeadOutcome("Nowy", "meeting", { meetingAt: "2026-09-02T11:00:00.000Z" }, now)).toMatch(/adres/);
    expect(validateLeadOutcome("Nowy", "resignation", {}, now)).toMatch(/powód rezygnacji/i);
    expect(validateLeadOutcome("Nowy", "resignation", { note: "Klient nie jest zainteresowany" }, now)).toBeNull();
    expect(validateLeadOutcome("Spotkanie", "contract", {}, now, "2026-09-02T09:00:00.000Z")).toMatch(/notatkę/);
    expect(validateLeadOutcome("Spotkanie", "contract", { note: "Klient zdecydowany" }, now, "2026-09-02T09:00:00.000Z")).toBeNull();
  });

  it("recognizes overdue callbacks and meetings", () => {
    expect(isMandatoryLead({ status: "Call back", callback_at: "2026-09-02T09:00:00.000Z", meeting_at: null }, now)).toBe(true);
    expect(isMandatoryLead({ status: "Spotkanie", callback_at: null, meeting_at: "2026-09-02T09:00:00.000Z" }, now)).toBe(true);
  });
});