import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, isValidSession } from "@/lib/session";
import {
  addLink,
  deleteLink,
  findLinkByUrl,
  getFolderById,
  moveLink,
  setLinkNote,
} from "@/lib/store";
import { isProfileLink } from "@/lib/linkkind";

async function authorized(request: NextRequest): Promise<boolean> {
  return isValidSession(request.cookies.get(SESSION_COOKIE)?.value);
}

function migrationPending(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === "42703";
}

export async function POST(request: NextRequest) {
  if (!(await authorized(request)))
    return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const { url, folderId, note } = await request.json();
    const trimmed = String(url ?? "").trim();
    if (!/^https?:\/\/\S+$/.test(trimmed))
      return NextResponse.json(
        { ok: false, error: "Isso não parece um link" },
        { status: 400 },
      );
    if (isProfileLink(trimmed))
      return NextResponse.json(
        {
          ok: false,
          error: "Link de perfil não é arquivado. Envie um vídeo: reel, post ou short",
        },
        { status: 422 },
      );
    const dup = await findLinkByUrl(trimmed);
    if (dup)
      return NextResponse.json(
        {
          ok: false,
          error: `Já minerado, está em #${dup.folder} (${dup.id})`,
        },
        { status: 409 },
      );
    let folderName = "inbox";
    if (folderId) {
      const folder = await getFolderById(Number(folderId));
      if (folder) folderName = folder.name;
    }
    const { folder, linkId } = await addLink(
      trimmed,
      folderName,
      "painel",
      trimmed,
      typeof note === "string" && note.trim() ? note.trim() : null,
    );
    return NextResponse.json({ ok: true, id: linkId, folder: folder.name });
  } catch (err) {
    console.error("link create error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await authorized(request)))
    return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const id = Number(request.nextUrl.searchParams.get("id"));
    if (!id)
      return NextResponse.json(
        { ok: false, error: "Id obrigatório" },
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
    const { id, folderId, note } = await request.json();
    if (folderId !== undefined) {
      const folder = await getFolderById(Number(folderId));
      if (!folder)
        return NextResponse.json(
          { ok: false, error: "pasta destino não existe" },
          { status: 404 },
        );
      await moveLink(Number(id), folder.id);
    }
    if (note !== undefined) {
      const clean = typeof note === "string" && note.trim() ? note.trim() : null;
      await setLinkNote(Number(id), clean);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (migrationPending(err))
      return NextResponse.json(
        { ok: false, error: "migração pendente (migration-notes.sql)" },
        { status: 500 },
      );
    console.error("link update error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
