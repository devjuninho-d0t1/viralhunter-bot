import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, isValidSession } from "@/lib/session";
import { listAllData } from "@/lib/store";

export async function GET(request: NextRequest) {
  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (!(await isValidSession(cookie))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    const data = await listAllData();
    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    console.error("platform data error:", err);
    return NextResponse.json(
      { ok: false, error: "erro ao carregar dados" },
      { status: 500 },
    );
  }
}
