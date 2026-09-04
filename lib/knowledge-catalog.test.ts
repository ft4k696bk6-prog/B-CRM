import { describe, expect, it } from "vitest";
import { BUILT_IN_KNOWLEDGE, filterKnowledge, knowledgeCategories } from "./knowledge-catalog";

describe("knowledge catalog", () => {
  it("contains restored materials from the core operational categories", () => {
    expect(knowledgeCategories(BUILT_IN_KNOWLEDGE)).toEqual([
      "Bezpieczeństwo", "Montaż", "Realizacja", "Rozliczenia", "Sprzedaż", "Umowy",
    ]);
  });

  it("filters by category and query", () => {
    expect(filterKnowledge(BUILT_IN_KNOWLEDGE, "podpis", "Umowy").map((item) => item.id)).toEqual([
      "built-in-contract-checklist",
    ]);
    expect(filterKnowledge(BUILT_IN_KNOWLEDGE, "", "Montaż")).toHaveLength(1);
  });
});
