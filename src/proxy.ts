import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { verifyToken } from "./lib/auth";

const intl = createMiddleware(routing);

const isAdminPage = (path: string) => path === "/admin" || path.startsWith("/admin/");
const isLoginPage = (path: string) => path === "/admin/login" || path.startsWith("/admin/login/");

/**
 * Server-side gate for the admin pages: no valid session token, no admin shell.
 * This only checks the token signature; every API route still calls getSession(), which also
 * checks the user row and password stamp in the database.
 */
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isAdminPage(pathname)) {
    if (isLoginPage(pathname)) return NextResponse.next();
    const token = request.cookies.get("admin_token")?.value;
    if (!token || !(await verifyToken(token))) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }
  return intl(request);
}

export const config = {
  matcher: ["/admin/:path*", "/((?!api|admin|sign|_next|_vercel|.*\..*).*)"],
};
