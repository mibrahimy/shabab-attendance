// Pakistani CNIC formatting: 13 digits grouped 5-7-1 → "00000-0000000-0".
// Pure helper shared by the inputs that accept a CNIC.

export function formatCnic(input: string): string {
  // The login field also accepts a legacy email — if the value has anything
  // other than digits/dashes, it isn't a CNIC, so leave it alone.
  if (/[^0-9-]/.test(input)) return input;

  const digits = input.replace(/\D/g, "").slice(0, 13);
  const parts = [digits.slice(0, 5)];
  if (digits.length > 5) parts.push(digits.slice(5, 12));
  if (digits.length > 12) parts.push(digits.slice(12, 13));
  return parts.join("-");
}
