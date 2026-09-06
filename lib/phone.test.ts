import { describe, expect, it } from "vitest";
import { formatPhoneReadable, normalizePhoneForDial } from "./phone";

describe("phone helpers", () => {
  it("normalizes a 9-digit Polish number for dialing", () => {
    expect(normalizePhoneForDial("600 123 456")).toBe("+48600123456");
  });

  it("keeps an already normalized Polish number", () => {
    expect(normalizePhoneForDial("+48 600 123 456")).toBe("+48600123456");
  });

  it("formats Polish numbers consistently", () => {
    expect(formatPhoneReadable("600123456")).toBe("+48 600 123 456");
  });

  it("rejects malformed phone numbers", () => {
    expect(normalizePhoneForDial("123")).toBeNull();
  });
});
