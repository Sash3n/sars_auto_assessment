/*
 * Input validation and sanitisation for every user-supplied value. Firestore
 * is not vulnerable to SQL injection, but malformed and oversized input is
 * still a real risk surface, so it is defended against explicitly here at
 * the model boundary.
 */

export const MAX_CURRENCY = 999_999_999.99;
export const MAX_LABEL_LENGTH = 80;

/**
 * Parse a user-typed currency string to a non-negative rand amount rounded
 * to the cent. Accepts spaces and commas as separators and an optional
 * leading "R". Returns null when the input is not a usable amount.
 */
export function parseCurrencyInput(raw: string): number | null {
  const cleaned = raw
    .trim()
    .replace(/^r/i, "")
    .replace(/[,\s]/g, "");
  if (cleaned === "" || !/^\d*\.?\d*$/.test(cleaned)) {
    return null;
  }
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }
  return clampCurrency(value);
}

/** Clamp any number into the valid currency range, rounded to the cent. */
export function clampCurrency(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.min(Math.round(value * 100) / 100, MAX_CURRENCY);
}

/*
 * Strip control characters and cap length of a free-form label. Deliberately
 * no trim: this runs on every keystroke in controlled inputs, and trimming
 * there would eat the space the user just typed mid-sentence.
 */
export function sanitizeLabel(raw: string): string {
  return Array.from(raw)
    .filter((char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127)
    .join("")
    .slice(0, MAX_LABEL_LENGTH);
}

/** Validate an ISO "YYYY-MM" month string. */
export function isIsoMonth(value: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(value)) {
    return false;
  }
  const month = Number.parseInt(value.slice(5, 7), 10);
  return month >= 1 && month <= 12;
}

/** Validate an ISO "YYYY-MM-DD" date string, including real day-of-month. */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map((p) => Number.parseInt(p, 10));
  if (month < 1 || month > 12 || day < 1) {
    return false;
  }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

/** Clamp a months-of-cover value to the whole months of a tax year. */
export function clampMonths(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(12, Math.max(0, Math.round(value)));
}

/** Clamp an apportionment percentage to 0..100. */
export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round(value * 100) / 100));
}
