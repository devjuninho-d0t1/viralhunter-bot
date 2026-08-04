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
    // Secure fixo derruba o login em http://localhost (o WebKit descarta o
    // cookie sem avisar) — em produção segue https, que é o que importa.
    secure: process.env.NODE_ENV === "production",
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
