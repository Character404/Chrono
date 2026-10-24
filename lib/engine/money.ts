/**
 * Money is always stored and calculated as integer cents (ZAR).
 * Never use floating-point rands for calculations.
 */
export type Cents = number;

export function isCents(value: unknown): value is Cents {
  return typeof value === "number" && Number.isSafeInteger(value);
}

export function assertCents(value: number, field = "amount"): void {
  if (!isCents(value)) throw new Error(`Invalid ${field}: ${value} (expected whole cents)`);
}

/** Converts rands to cents, e.g. rand(5000) === 500000. Handy for tests and seed data. */
export function rand(rands: number): Cents {
  return Math.round(rands * 100);
}

/** Rounds up to the next multiple of step, e.g. roundUpTo(120001, 5000) === 125000. */
export function roundUpTo(cents: Cents, step: Cents): Cents {
  if (step <= 0) return cents;
  return Math.ceil(cents / step) * step;
}

/** Formats cents South African style: "R5 000", "R1 234,50", "−R200". */
export function formatRand(cents: Cents): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const fraction = abs % 100;
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const decimals = fraction ? `,${String(fraction).padStart(2, "0")}` : "";
  return `${negative ? "−" : ""}R${grouped}${decimals}`;
}

/**
 * Parses what a person types as a rand amount into cents.
 * Accepts "5000", "5 000", "R5 000", "1234,50", "1234.50". Returns null if it isn't a valid amount.
 */
export function parseRandInput(text: string): Cents | null {
  const cleaned = text.trim().replace(/^R/i, "").replace(/[\s\u00a0]/g, "").replace(",", ".");
  if (cleaned === "" || !/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}
