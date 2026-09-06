import { describe, expect, it } from "vitest";
import { formatPhoneReadable, normalizePhoneE164, normalizePhoneForDial } from "./phone";

describe("phone helpers", () => {
  it("normalizes a 9-digit Polish number for storage and dialing", () => {
    expect(normalizePhoneE164("600 123 456")).toBe("+48600123456");
    expect(normalizePhoneForDial("600 123 456")).toBe("+48600123456");
  });

  it("normalizes a Polish number with country code but without plus", () => {
    expect(normalizePhoneE164("48 600 123 456")).toBe("+48600123456");
  });

  it("converts international 00 prefix to plus", () => {
    expect(normalizePhoneE164("0049 151 453 42317")).toBe("+4915145342317");
  });

  it("keeps an explicit international number instead of assuming Poland", () => {
    expect(normalizePhoneE164("+1 (732) 558-4435")).toBe("+17325584435");
  });

  it("formats Polish numbers consistently", () => {
    expect(formatPhoneReadable("600123456")).toBe("+48 600 123 456");
  });

  it("rejects malformed or ambiguous local numbers", () => {
    expect(normalizePhoneE164("123")).toBeNull();
    expect(normalizePhoneE164("5083140474133")).toBeNull();
    expect(normalizePhoneE164("+48+600123456")).toBeNull();
  });
});
