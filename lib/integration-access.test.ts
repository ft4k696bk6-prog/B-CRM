import { describe, expect, it } from "vitest";
import { hasPermission } from "@/lib/permissions";

describe("Google Workspace integration access", () => {
  it("allows the owner to manage integrations", () => {
    expect(hasPermission("owner", "integrations:manage")).toBe(true);
  });

  it("does not expose integrations to sales or managers", () => {
    expect(hasPermission("handlowiec", "integrations:manage")).toBe(false);
    expect(hasPermission("menadzer", "integrations:manage")).toBe(false);
  });
});
