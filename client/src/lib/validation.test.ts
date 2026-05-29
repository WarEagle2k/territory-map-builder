import { describe, it, expect } from "vitest";
import { validatePhone, normalizePhone, validateEmail } from "./validation";

describe("validatePhone", () => {
  it("treats empty/whitespace as valid (field is optional)", () => {
    expect(validatePhone("")).toBeNull();
    expect(validatePhone("   ")).toBeNull();
  });
  it("accepts 10-digit numbers in any punctuation", () => {
    expect(validatePhone("555-123-4567")).toBeNull();
    expect(validatePhone("(555) 123 4567")).toBeNull();
  });
  it("accepts 11-digit numbers starting with 1", () => {
    expect(validatePhone("1-555-123-4567")).toBeNull();
  });
  it("rejects numbers with the wrong digit count", () => {
    expect(validatePhone("12345")).toBeTypeOf("string");
    expect(validatePhone("2-555-123-4567")).toBeTypeOf("string");
  });
});

describe("normalizePhone", () => {
  it("formats a 10-digit number", () => {
    expect(normalizePhone("5551234567")).toBe("(555) 123-4567");
  });
  it("formats an 11-digit number with country code", () => {
    expect(normalizePhone("15551234567")).toBe("+1 (555) 123-4567");
  });
  it("falls back to the trimmed input for odd lengths", () => {
    expect(normalizePhone("  ext 12  ")).toBe("ext 12");
  });
});

describe("validateEmail", () => {
  it("treats empty as valid (field is optional)", () => {
    expect(validateEmail("")).toBeNull();
  });
  it("accepts a normal address", () => {
    expect(validateEmail("rep@company.com")).toBeNull();
  });
  it("rejects malformed addresses", () => {
    expect(validateEmail("nope")).toBeTypeOf("string");
    expect(validateEmail("a@b")).toBeTypeOf("string");
    expect(validateEmail("a b@c.com")).toBeTypeOf("string");
  });
});
