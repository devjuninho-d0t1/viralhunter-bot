import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  isValidPassword,
  sessionToken,
} from "@/lib/session";

export async function POST(request: NextRequest) {
  const { password } = await request
    .json()
    .catch(() => ({ password: "" }));

  if (!(await isValidPassword(password))) {
    return NextResponse.json(
      { ok: false, error: "senha incorreta" },
      { status: 401 },
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await sessionToken(), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
