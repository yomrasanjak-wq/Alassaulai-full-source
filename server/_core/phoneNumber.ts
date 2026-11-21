/** Normalize Saudi mobile input to E.164 without persisting the raw value. */
export function normalizeSaudiPhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const compact = value.trim().replace(/[\s()-]/g, "");
  const phone = compact.startsWith("05")
    ? `+966${compact.slice(1)}`
    : compact.startsWith("5") && compact.length === 9
      ? `+966${compact}`
      : compact.startsWith("00966")
        ? `+${compact.slice(2)}`
        : compact;
  return /^\+9665\d{8}$/.test(phone) ? phone : null;
}
