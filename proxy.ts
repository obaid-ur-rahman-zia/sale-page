import { NextResponse, type NextRequest } from "next/server";

/**
 * Opt-in HTTP Basic auth for the admin screen and the category write endpoints.
 * Set ADMIN_PASSWORD (and optionally ADMIN_USER) to switch it on; with the
 * variable unset the app behaves exactly as before and nothing is gated.
 */
const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function unauthorized() {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Sale Page Admin", charset="UTF-8"' },
  });
}

export function proxy(request: NextRequest) {
  const password = process.env.ADMIN_PASSWORD?.trim();
  if (!password) {
    return NextResponse.next();
  }

  const isAdminPage = request.nextUrl.pathname.startsWith("/admin");
  const isCategoryWrite =
    request.nextUrl.pathname.startsWith("/api/categories") &&
    !READ_ONLY_METHODS.has(request.method);

  if (!isAdminPage && !isCategoryWrite) {
    return NextResponse.next();
  }

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Basic ")) {
    return unauthorized();
  }

  let decoded: string;
  try {
    decoded = atob(header.slice("Basic ".length));
  } catch {
    return unauthorized();
  }

  const separator = decoded.indexOf(":");
  const user = separator === -1 ? "" : decoded.slice(0, separator);
  const suppliedPassword = separator === -1 ? "" : decoded.slice(separator + 1);
  const expectedUser = process.env.ADMIN_USER?.trim() || "admin";

  if (user !== expectedUser || suppliedPassword !== password) {
    return unauthorized();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/categories/:path*"],
};
