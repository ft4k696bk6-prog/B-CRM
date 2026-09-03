import { describe, expect, it } from "vitest";
import { MANDATORY_QUEUE_ROLLOUT_AT, wasCurrentScheduleSetAfterRollout } from "@/lib/server-lead-work";

const lead = {
  id: "lead-1",
  status: "Call back" as const,
  callback_at: "2026-09-03T08:00:00.000Z",
  meeting_at: null
};

describe("mandatory queue rollout cutoff", () => {
  it("ignores an overdue schedule created before the rollout", () => {
    expect(wasCurrentScheduleSetAfterRollout(lead, [{
      lead_id: lead.id,
      created_at: "2026-09-02T21:59:59.999Z",
      new_value: { callback_at: lead.callback_at }
    }])).toBe(false);
  });

  it("includes the current schedule when it was set from today onward", () => {
    expect(wasCurrentScheduleSetAfterRollout(lead, [{
      lead_id: lead.id,
      created_at: MANDATORY_QUEUE_ROLLOUT_AT,
      new_value: { callback_at: lead.callback_at }
    }])).toBe(true);
  });

  it("does not revive an older term after the callback was rescheduled", () => {
    expect(wasCurrentScheduleSetAfterRollout(lead, [{
      lead_id: lead.id,
      created_at: "2026-09-03T07:00:00.000Z",
      new_value: { callback_at: "2026-09-03T07:30:00.000Z" }
    }])).toBe(false);
  });
});
