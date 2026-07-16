import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, isValidSession } from "@/lib/session";
import {
  createFolder,
  deleteFolderById,
  getFolder,
  getFolderById,
  renameFolderById,
} from "@/lib/store";

const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} ._-]{0,29}$/u;

async function authorized(request: NextRequest): Promise<boolean> {
  return isValidSession(request.cookies.get(SESSION_COOKIE)?.value);
}

export async function POST(request: NextRequest) {
  if (!(await authorized(request)))
    return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const { name } = await request.json();
    if (typeof name !== "string" || !NAME_RE.test(name.trim())) {
      return NextResponse.json(
        { ok: false, error: "nome inválido" },
        { status: 400 },
      );
    }
    if (await getFolder(name)) {
      return NextResponse.json(
        { ok: false, error: "pasta já existe" },
        { status: 409 },
      );
    }
    const folder = await createFolder(name, "plataforma");
    return NextResponse.json({ ok: true, folder });
  } catch (err) {
    console.error("folder create error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await authorized(request)))
    return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const { id, name } = await request.json();
    const folder = await getFolderById(Number(id));
    if (!folder)
      return NextResponse.json(
        { ok: false, error: "pasta não encontrada" },
        { status: 404 },
      );
    if (folder.name === "inbox")
      return NextResponse.json(
        { ok: false, error: "inbox é protegida" },
        { status: 400 },
      );
    if (typeof name !== "string" || !NAME_RE.test(name.trim())) {
      return NextResponse.json(
        { ok: false, error: "nome inválido" },
        { status: 400 },
      );
    }
    if (await getFolder(name)) {
      return NextResponse.json(
        { ok: false, error: "já existe pasta com esse nome" },
        { status: 409 },
      );
    }
    await renameFolderById(folder.id, name);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("folder rename error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await authorized(request)))
    return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const id = Number(request.nextUrl.searchParams.get("id"));
    const folder = await getFolderById(id);
    if (!folder)
      return NextResponse.json(
        { ok: false, error: "pasta não encontrada" },
        { status: 404 },
      );
    if (folder.name === "inbox")
      return NextResponse.json(
        { ok: false, error: "inbox é protegida" },
        { status: 400 },
      );
    await deleteFolderById(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("folder delete error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
