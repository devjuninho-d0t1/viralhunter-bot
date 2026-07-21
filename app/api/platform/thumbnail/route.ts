import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, isValidSession } from "@/lib/session";
import { getLinkById, setThumbnail } from "@/lib/store";
import { resolveAndStore } from "@/lib/thumbnail";

/**
 * Resolve a capa (primeiro frame) de UM link sob demanda e devolve a URL
 * hospedada. Idempotente: se já está 'ok', retorna direto sem re-resolver.
 * A vitrine chama isto (com concorrência baixa) pros links ainda 'pending'.
 */
export async function POST(request: NextRequest) {
  if (!(await isValidSession(request.cookies.get(SESSION_COOKIE)?.value)))
    return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const { linkId } = await request.json();
    const id = Number(linkId);
    if (!id)
      return NextResponse.json(
        { ok: false, error: "linkId obrigatório" },
        { status: 400 },
      );

    const link = await getLinkById(id);
    if (!link)
      return NextResponse.json(
        { ok: false, error: "link não encontrado" },
        { status: 404 },
      );

    const { status, thumbnailUrl } = await resolveAndStore(id, link.url);
    await setThumbnail(id, thumbnailUrl, status);

    return NextResponse.json({ ok: true, status, thumbnailUrl });
  } catch (err) {
    console.error("thumbnail resolve error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
