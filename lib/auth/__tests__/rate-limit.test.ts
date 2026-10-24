import { describe, expect, it } from "vitest";
import { clearLoginFailures, isLoginBlocked, recordLoginFailure } from "../rate-limit";

describe("Login rate limit", () => {
  it("blocks after 5 failures and unblocks after 15 minutes", () => {
    const key = "test@example.com";
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) recordLoginFailure(key, t0);
    expect(isLoginBlocked(key, t0 + 1000)).toBe(true);
    expect(isLoginBlocked(key, t0 + 16 * 60 * 1000)).toBe(false);
  });

  it("clears after a successful login", () => {
    const key = "ok@example.com";
    for (let i = 0; i < 5; i++) recordLoginFailure(key);
    clearLoginFailures(key);
    expect(isLoginBlocked(key)).toBe(false);
  });
});
