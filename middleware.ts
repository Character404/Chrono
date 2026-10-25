import { NextResponse, type NextRequest } from "next/server";

/**
 * Security headers on every response.
 * - CSP: only our own scripts, styles, fonts and images; no framing by other sites.
 * - Clickjacking, MIME sniffing and referrer leaks are blocked.
 * Development needs 'unsafe-eval' and websockets for hot reload; production does not.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const dev = process.env.NODE_ENV !== "production";

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  if (!dev) response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  // Quote links are private to whoever receives them: keep them out of search engines.
  if (request.nextUrl.pathname.startsWith("/q/")) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  // Skip static build files and images; everything else gets the headers.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
