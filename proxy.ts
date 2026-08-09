import { NextResponse, type NextRequest } from "next/server";

/**
 * Opt-in sign-in for the admin screen. Set ADMIN_PASSWORD (and optionally
 * ADMIN_USER, default "admin") to switch it on; with the variable unset nothing
 * is gated and the app behaves exactly as before.
 *
 * The browser sign-in box is raised on /admin only. Signing in there stores a
 * session cookie, and the category write endpoints accept that cookie — so they
 * stay protected without ever popping a second prompt at the user.
 */
const SESSION_COOKIE = "salepage_admin";
const SESSION_PAYLOAD = "salepage-admin-v1";
const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

async function sessionToken(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(SESSION_PAYLOAD));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function equals(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}

function readBasicCredentials(request: NextRequest) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Basic ")) {
    return null;
  }

  let decoded: string;
  try {
    decoded = atob(header.slice("Basic ".length));
  } catch {
    return null;
  }

  const separator = decoded.indexOf(":");
  if (separator === -1) {
    return null;
  }

  return { user: decoded.slice(0, separator), password: decoded.slice(separator + 1) };
}

function promptForSignIn() {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Sale Page Admin", charset="UTF-8"' },
  });
}

export async function proxy(request: NextRequest) {
  const password = process.env.ADMIN_PASSWORD?.trim();
  if (!password) {
    return NextResponse.next();
  }

  const path = request.nextUrl.pathname;
  const isAdminPage = path.startsWith("/admin");
  const isCategoryWrite =
    path.startsWith("/api/categories") && !READ_ONLY_METHODS.has(request.method);

  if (!isAdminPage && !isCategoryWrite) {
    return NextResponse.next();
  }

  const expectedToken = await sessionToken(password);
  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (cookie && equals(cookie, expectedToken)) {
    return NextResponse.next();
  }

  if (isCategoryWrite) {
    // Deliberately no WWW-Authenticate header: a fetch() must never raise the
    // browser's sign-in box. Sign in on /admin first.
    return NextResponse.json({ message: "Admin sign-in required." }, { status: 401 });
  }

  const credentials = readBasicCredentials(request);
  const expectedUser = process.env.ADMIN_USER?.trim() || "admin";

  if (
    !credentials ||
    !equals(credentials.user, expectedUser) ||
    !equals(credentials.password, password)
  ) {
    return promptForSignIn();
  }

  const response = NextResponse.next();
  response.cookies.set({
    name: SESSION_COOKIE,
    value: expectedToken,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: request.nextUrl.protocol === "https:",
  });
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/api/categories/:path*"],
};
