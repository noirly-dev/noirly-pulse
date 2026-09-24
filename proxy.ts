import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isLastScopePath, LAST_SCOPE_COOKIE } from "@/src/lib/last-scope";

export const proxy = auth((request) => {
  const { pathname } = request.nextUrl;
  const isLanding = pathname === "/";
  const isLogin = pathname === "/login";
  const isLoginPopup =
    pathname === "/login/popup" || pathname === "/login/popup-complete";
  const isAuthApi = pathname.startsWith("/api/auth");
  // Brand logo and other APIs authenticate themselves; do not bounce unsigned
  // visitors (or BrandMark) through /login.
  const isApi = pathname.startsWith("/api/");

  if (
    !request.auth &&
    !isLanding &&
    !isLogin &&
    !isLoginPopup &&
    !isAuthApi &&
    !isApi
  ) {
    const login = new URL("/login", request.nextUrl.origin);
    if (pathname !== "/") {
      login.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(login);
  }

  // Signed-in landings reopen the last conversation (§7.5), else the inbox.
  const lastScope = request.cookies.get(LAST_SCOPE_COOKIE)?.value;
  const home = isLastScopePath(lastScope) ? lastScope : "/inbox";

  if (request.auth && isLogin) {
    const next = request.nextUrl.searchParams.get("next");
    if (next && next.startsWith("/") && !next.startsWith("//") && next !== "/inbox") {
      return NextResponse.redirect(new URL(next, request.nextUrl.origin));
    }
    return NextResponse.redirect(new URL(home, request.nextUrl.origin));
  }

  if (request.auth && isLanding) {
    return NextResponse.redirect(new URL(home, request.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
