/**
 * Simple login rate limit: at most 5 failed attempts per email per 15 minutes.
 * In-memory, so it resets when a server instance restarts. Good enough for the
 * prototype; production would use a shared store.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const failures = new Map<string, { count: number; since: number }>();

export function isLoginBlocked(key: string, now = Date.now()): boolean {
  const entry = failures.get(key);
  if (!entry) return false;
  if (now - entry.since > WINDOW_MS) {
    failures.delete(key);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

export function recordLoginFailure(key: string, now = Date.now()): void {
  const entry = failures.get(key);
  if (!entry || now - entry.since > WINDOW_MS) failures.set(key, { count: 1, since: now });
  else entry.count++;
}

export function clearLoginFailures(key: string): void {
  failures.delete(key);
}
