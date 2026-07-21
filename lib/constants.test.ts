import { describe, expect, it } from "vitest";
import { LEAD_STATUSES, STATUS_LABELS, STATUS_TONES } from "@/lib/constants";

describe("lead status constants", () => {
  it("keeps all lead statuses covered by labels and visual tones", () => {
    for (const status of LEAD_STATUSES) {
      expect(STATUS_LABELS[status]).toBeTruthy();
      expect(STATUS_TONES[status]).toBeTruthy();
    }
  });

  it("contains the core sales workflow statuses", () => {
    expect(LEAD_STATUSES).toEqual(
      ["Nowy", "Nie odebrał", "Call back", "Spotkanie", "Po spotkaniu", "Umowa", "Rezygnacja"]
    );
  });
});
