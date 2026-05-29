// Shared, testable validation + formatting helpers for rep contact fields.
// Used by the rep details dialog (live validation) and the PDF export
// (display formatting), so both stay consistent.

/** Error message if the phone is non-empty and not a valid US number, else null. */
export function validatePhone(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return null;
  if (digits.length === 11 && digits.startsWith("1")) return null;
  return "Enter a 10-digit US phone number (e.g. 555-123-4567).";
}

/** Normalize a US phone number for display; falls back to the trimmed input.
 *  10 digits → "(XXX) XXX-XXXX"; 11 with leading 1 → "+1 (XXX) XXX-XXXX". */
export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return value.trim();
}

/** Error message if the email is non-empty and malformed, else null. */
export function validateEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Practical, not RFC-5322 strict — catches typos without rejecting valid edge cases.
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (re.test(trimmed)) return null;
  return "Enter a valid email address (e.g. rep@company.com).";
}
