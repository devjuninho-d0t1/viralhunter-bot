import { NextRequest, NextResponse } from "next/server";
import { extensionToken, isValidPassword } from "@/lib/session";

/** CORS: a extensão fala daqui de origens variadas (chrome-extension://…). */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * Troca a senha do time pelo token da extensão. A extensão guarda só o
 * token — a senha não fica salva em lugar nenhum.
 */
export async function POST(request: NextRequest) {
  const { password } = await request
    .json()
    .catch(() => ({ password: "" }));

  if (!(await isValidPassword(String(password ?? "")))) {
    return NextResponse.json(
      { ok: false, error: "Senha incorreta" },
      { status: 401, headers: CORS },
    );
  }

  return NextResponse.json(
    { ok: true, token: await extensionToken() },
    { headers: CORS },
  );
}
