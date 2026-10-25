import { describe, expect, it } from "vitest";
import { MAX_FAILURES, shouldBlock, WINDOW_MS } from "../rate-limit";

describe("Login rate limit rule", () => {
  it("allows up to 4 recent failures and blocks at 5", () => {
    expect(shouldBlock(0)).toBe(false);
    expect(shouldBlock(MAX_FAILURES - 1)).toBe(false);
    expect(shouldBlock(MAX_FAILURES)).toBe(true);
  });

  it("uses a 15-minute window", () => {
    expect(WINDOW_MS).toBe(15 * 60 * 1000);
  });
});
