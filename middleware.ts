import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, isValidSession } from "@/lib/session";

export async function middleware(request: NextRequest) {
  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  const valid = await isValidSession(cookie);
  const { pathname } = request.nextUrl;

  // login ("/") com sessão válida → manda pro painel
  if (pathname === "/") {
    if (valid) {
      return NextResponse.redirect(new URL("/painel", request.url));
    }
    return NextResponse.next();
  }

  // "/painel..." sem sessão válida → manda pro login
  if (!valid) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/painel/:path*"],
};
