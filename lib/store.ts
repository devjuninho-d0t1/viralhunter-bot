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
  const { data: links, error: lErr } = await db()
    .from("links")
    .select("id, url, folder_id, added_by, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (lErr) throw lErr;
  const nameById = new Map((folders ?? []).map((f) => [f.id, f.name]));
  const counts = new Map<number, number>();
  for (const l of links ?? []) {
    counts.set(l.folder_id, (counts.get(l.folder_id) ?? 0) + 1);
  }
  return {
    folders: (folders ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      count: counts.get(f.id) ?? 0,
    })),
    links: (links ?? []).map((l) => ({
      ...l,
      folder: nameById.get(l.folder_id) ?? "?",
    })),
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

export async function listLinks(folderName: string): Promise<Link[] | null> {
  const folder = await getFolder(folderName);
  if (!folder) return null;
  const { data, error } = await db()
    .from("links")
    .select("id, url, folder_id, added_by, created_at")
    .eq("folder_id", folder.id)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return data ?? [];
}
