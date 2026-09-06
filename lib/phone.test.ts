import { describe, expect, it } from "vitest";
import { formatPhoneReadable, normalizePhoneForDial } from "@/lib/phone";

describe("phone helpers", () => {
  it("adds the Polish country code to a 9-digit local number", () => {
    expect(normalizePhoneForDial("600 123 456")).toBe("+48600123456");
  });

  it("normalizes Polish numbers already containing country code", () => {
    expect(normalizePhoneForDial("48 600 123 456")).toBe("+48600123456");
    expect(normalizePhoneForDial("0048 600 123 456")).toBe("+48600123456");
    expect(normalizePhoneForDial("+48 600 123 456")).toBe("+48600123456");
  });

  it("rejects invalid dial strings instead of creating a malformed tel link", () => {
    expect(normalizePhoneForDial("123")).toBeNull();
  });

  it("formats Polish phone numbers consistently", () => {
    expect(formatPhoneReadable("600123456")).toBe("+48 600 123 456");
  });
});
