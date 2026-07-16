import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, isValidSession } from "@/lib/session";
import { deleteLink, getFolderById, moveLink } from "@/lib/store";

async function authorized(request: NextRequest): Promise<boolean> {
  return isValidSession(request.cookies.get(SESSION_COOKIE)?.value);
}

export async function DELETE(request: NextRequest) {
  if (!(await authorized(request)))
    return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const id = Number(request.nextUrl.searchParams.get("id"));
    if (!id)
      return NextResponse.json(
        { ok: false, error: "id obrigatório" },
        { status: 400 },
      );
    await deleteLink(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("link delete error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await authorized(request)))
    return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const { id, folderId } = await request.json();
    const folder = await getFolderById(Number(folderId));
    if (!folder)
      return NextResponse.json(
        { ok: false, error: "pasta destino não existe" },
        { status: 404 },
      );
    await moveLink(Number(id), folder.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("link move error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
