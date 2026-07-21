import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _client;
}

export interface Folder {
  id: number;
  name: string;
}

export interface Link {
  id: number;
  url: string;
  folder_id: number;
  added_by: string | null;
  created_at: string;
  thumbnail_url: string | null;
  thumbnail_status: string | null;
}

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

export async function listFolders(): Promise<
  { name: string; count: number }[]
> {
  const { data: folders, error } = await db()
    .from("folders")
    .select("id, name")
    .order("name");
  if (error) throw error;
  const { data: links } = await db().from("links").select("folder_id");
  const counts = new Map<number, number>();
  for (const l of links ?? []) {
    counts.set(l.folder_id, (counts.get(l.folder_id) ?? 0) + 1);
  }
  return (folders ?? []).map((f) => ({
    name: f.name,
    count: counts.get(f.id) ?? 0,
  }));
}

export async function getFolder(name: string): Promise<Folder | null> {
  const { data } = await db()
    .from("folders")
    .select("id, name")
    .eq("name", normalize(name))
    .maybeSingle();
  return data;
}

export async function createFolder(
  name: string,
  createdBy: string,
): Promise<Folder> {
  const { data, error } = await db()
    .from("folders")
    .insert({ name: normalize(name), created_by: createdBy })
    .select("id, name")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFolder(name: string): Promise<boolean> {
  const folder = await getFolder(name);
  if (!folder) return false;
  const { error } = await db().from("folders").delete().eq("id", folder.id);
  if (error) throw error;
  return true;
}

export async function renameFolder(
  oldName: string,
  newName: string,
): Promise<boolean> {
  const folder = await getFolder(oldName);
  if (!folder) return false;
  const { error } = await db()
    .from("folders")
    .update({ name: normalize(newName) })
    .eq("id", folder.id);
  if (error) throw error;
  return true;
}

export async function addLink(
  url: string,
  folderName: string,
  addedBy: string,
  rawMessage: string,
): Promise<{ folder: Folder; linkId: number }> {
  let folder = await getFolder(folderName);
  if (!folder) {
    try {
      folder = await createFolder(folderName, addedBy);
    } catch {
      // corrida: outro miner criou a mesma pasta no meio do caminho
      folder = await getFolder(folderName);
      if (!folder) throw new Error(`folder create failed: ${folderName}`);
    }
  }
  const { data, error } = await db()
    .from("links")
    .insert({
      url,
      folder_id: folder.id,
      added_by: addedBy,
      raw_message: rawMessage,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { folder, linkId: data.id };
}

// ── Plataforma web ──

export interface LinkRow extends Link {
  folder: string;
}

export async function listAllData(): Promise<{
  folders: { id: number; name: string; count: number }[];
  links: LinkRow[];
}> {
  const { data: folders, error: fErr } = await db()
    .from("folders")
    .select("id, name")
    .order("name");
  if (fErr) throw fErr;
  let links: Record<string, unknown>[] | null = null;
  const withThumbs = await db()
    .from("links")
    .select(
      "id, url, folder_id, added_by, created_at, thumbnail_url, thumbnail_status",
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (withThumbs.error) {
    // colunas de thumbnail ainda não migradas → cai pro básico sem quebrar
    if (withThumbs.error.code === "42703") {
      const base = await db()
        .from("links")
        .select("id, url, folder_id, added_by, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (base.error) throw base.error;
      links = base.data;
    } else {
      throw withThumbs.error;
    }
  } else {
    links = withThumbs.data;
  }
  const nameById = new Map((folders ?? []).map((f) => [f.id, f.name]));
  const rows: LinkRow[] = (links ?? []).map((l) => {
    const folderId = l.folder_id as number;
    return {
      id: l.id as number,
      url: l.url as string,
      folder_id: folderId,
      added_by: (l.added_by as string | null) ?? null,
      created_at: l.created_at as string,
      thumbnail_url: (l.thumbnail_url as string | null) ?? null,
      thumbnail_status: (l.thumbnail_status as string | null) ?? null,
      folder: nameById.get(folderId) ?? "?",
    };
  });
  const counts = new Map<number, number>();
  for (const r of rows) {
    counts.set(r.folder_id, (counts.get(r.folder_id) ?? 0) + 1);
  }
  return {
    folders: (folders ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      count: counts.get(f.id) ?? 0,
    })),
    links: rows,
  };
}

export async function getFolderById(
  id: number,
): Promise<Folder | null> {
  const { data } = await db()
    .from("folders")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function renameFolderById(
  id: number,
  newName: string,
): Promise<boolean> {
  const { error } = await db()
    .from("folders")
    .update({ name: normalize(newName) })
    .eq("id", id);
  if (error) throw error;
  return true;
}

export async function deleteFolderById(id: number): Promise<void> {
  const { error } = await db().from("folders").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteLink(id: number): Promise<void> {
  const { error } = await db().from("links").delete().eq("id", id);
  if (error) throw error;
}

export async function moveLink(
  id: number,
  folderId: number,
): Promise<void> {
  const { error } = await db()
    .from("links")
    .update({ folder_id: folderId })
    .eq("id", id);
  if (error) throw error;
}

export async function listLinks(
  folderName: string,
): Promise<{ url: string }[] | null> {
  const folder = await getFolder(folderName);
  if (!folder) return null;
  const { data, error } = await db()
    .from("links")
    .select("url")
    .eq("folder_id", folder.id)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return data ?? [];
}

export async function getLinkById(
  id: number,
): Promise<{ id: number; url: string; thumbnail_status: string | null } | null> {
  const { data } = await db()
    .from("links")
    .select("id, url, thumbnail_status")
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function setThumbnail(
  id: number,
  url: string | null,
  status: "ok" | "failed",
): Promise<void> {
  const { error } = await db()
    .from("links")
    .update({ thumbnail_url: url, thumbnail_status: status })
    .eq("id", id);
  if (error) throw error;
}
