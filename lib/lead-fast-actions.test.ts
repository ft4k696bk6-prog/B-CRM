import { describe, expect, it } from "vitest";
import { allowedOutcomes } from "@/lib/lead-outcomes";

describe("lead fast actions", () => {
  it("offers one-tap contact actions for a new lead", () => {
    expect(allowedOutcomes("Nowy")).toEqual(expect.arrayContaining(["callback", "meeting", "no_answer", "return"]));
  });

  it("offers contract and resignation after a completed meeting", () => {
    expect(allowedOutcomes("Po spotkaniu")).toEqual(expect.arrayContaining(["contract", "resignation", "callback", "return"]));
  });

  it("does not expose status mutations for terminal states", () => {
    expect(allowedOutcomes("Umowa")).toEqual([]);
    expect(allowedOutcomes("Rezygnacja")).toEqual([]);
  });
});
