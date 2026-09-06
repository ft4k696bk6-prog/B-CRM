import { describe, expect, it } from "vitest";
import { formatPhoneReadable, normalizePhoneE164, normalizePhoneForDial } from "./phone";

describe("phone helpers", () => {
  it("normalizes a 9-digit Polish number to canonical E.164", () => {
    expect(normalizePhoneE164("600 123 456")).toBe("+48600123456");
    expect(normalizePhoneE164("48 600 123 456")).toBe("+48600123456");
  });

  it("keeps an already normalized Polish number", () => {
    expect(normalizePhoneForDial("+48 600 123 456")).toBe("+48600123456");
  });

  it("converts international 00 prefix", () => {
    expect(normalizePhoneE164("0049 151 23456789")).toBe("+4915123456789");
  });

  it("formats Polish numbers consistently", () => {
    expect(formatPhoneReadable("600123456")).toBe("+48 600 123 456");
  });

  it("rejects malformed phone numbers", () => {
    expect(normalizePhoneE164("123")).toBeNull();
    expect(normalizePhoneE164("+48 +48 600123456")).toBeNull();
  });
});