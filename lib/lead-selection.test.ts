import { describe, expect, it } from "vitest";
import { selectLeadRange } from "@/lib/lead-selection";

describe("selectLeadRange", () => {
  const ids = Array.from({ length: 60 }, (_, index) => `lead-${index + 1}`);

  it.each([20, 25, 30, 50])("selects %i records starting at the anchor", (size) => {
    expect(selectLeadRange(ids, "lead-6", size, [])).toEqual(ids.slice(5, 5 + size));
  });

  it("stops at the end of the visible list", () => {
    expect(selectLeadRange(ids, "lead-56", 20, [])).toEqual(ids.slice(55));
  });

  it("preserves earlier selections and follows current visible order", () => {
    expect(selectLeadRange(["c", "a", "b"], "a", 2, ["existing"])).toEqual(["existing", "a", "b"]);
  });
});
