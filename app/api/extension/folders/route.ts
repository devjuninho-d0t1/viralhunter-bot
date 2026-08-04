import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedRequest } from "@/lib/session";
import { listAllData } from "@/lib/store";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/** Só as pastas, para o seletor da extensão. */
export async function GET(request: NextRequest) {
  if (!(await isAuthorizedRequest(request)))
    return NextResponse.json({ ok: false }, { status: 401, headers: CORS });
  try {
    const { folders } = await listAllData();
    return NextResponse.json(
      { ok: true, folders: folders.map((f) => ({ id: f.id, name: f.name })) },
      { headers: CORS },
    );
  } catch (err) {
    console.error("extension folders error:", err);
    return NextResponse.json(
      { ok: false, error: "Erro ao carregar pastas" },
      { status: 500, headers: CORS },
    );
  }
}
