import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, isValidSession } from "@/lib/session";
import { listMiners, setAlias, tableMissing } from "@/lib/miners";

async function authorized(request: NextRequest): Promise<boolean> {
  return isValidSession(request.cookies.get(SESSION_COOKIE)?.value);
}

export async function GET(request: NextRequest) {
  if (!(await authorized(request)))
    return NextResponse.json({ ok: false }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, miners: await listMiners() });
  } catch (err) {
    console.error("miners list error:", err);
    return NextResponse.json(
      { ok: false, error: "erro ao carregar mineradores" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await authorized(request)))
    return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const { key, displayName } = await request.json();
    const raw = String(key ?? "").trim();
    if (!raw)
      return NextResponse.json(
        { ok: false, error: "Minerador obrigatório" },
        { status: 400 },
      );
    const name = String(displayName ?? "").trim();
    if (name.length > 40)
      return NextResponse.json(
        { ok: false, error: "Nome muito longo (máximo 40 caracteres)" },
        { status: 400 },
      );
    await setAlias(raw, name || null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (tableMissing(err))
      return NextResponse.json(
        { ok: false, error: "Execute migration-miners.sql no Supabase" },
        { status: 409 },
      );
    console.error("miner alias error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
