import { randomBytes } from "node:crypto";

/** A random 128-bit, URL-safe token for public quote links. */
export function newQuoteToken(): string {
  return randomBytes(16).toString("base64url");
}
