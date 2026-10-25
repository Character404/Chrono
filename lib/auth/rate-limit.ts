/**
 * Login rate-limit rule: at most 5 failed attempts per email in 15 minutes.
 * The counting is stored in the database (see attempts.ts), so it survives
 * server restarts and works across every server instance.
 */
export const WINDOW_MS = 15 * 60 * 1000;
export const MAX_FAILURES = 5;

export function shouldBlock(recentFailures: number): boolean {
  return recentFailures >= MAX_FAILURES;
}
