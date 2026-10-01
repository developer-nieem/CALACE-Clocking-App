/** Authoritative money rounding. Prefer this over raw IEEE floats for pay, billing, and invoices. */

export function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function roundHours(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function hoursToPay(hours: number, hourlyRate: number) {
  return roundMoney(roundHours(hours) * hourlyRate);
}

export function csvCell(value: string | number) {
  let text = String(value ?? "");
  if (/^[=+\-@|]/.test(text) || text.startsWith("\t")) {
    text = `'${text}`;
  }
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
