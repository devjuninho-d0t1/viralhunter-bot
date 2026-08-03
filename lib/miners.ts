/**
 * Apelidos de minerador.
 *
 * `added_by` guarda o nome cru que o canal mandou (senderName do WhatsApp,
 * username do Telegram, "painel"), então a mesma pessoa aparece com nomes
 * diferentes. Aqui esses nomes são colapsados num nome único de exibição,
 * resolvido na LEITURA — o histórico se corrige junto e nenhum dado é perdido.
 */

import { db } from "./db";

export type AliasMap = Record<string, string>;

export interface MinerRow {
  /** chave normalizada (é o que a API recebe pra gravar o apelido) */
  key: string;
  /** um dos nomes crus que caem nessa chave, como referência visual */
  raw: string;
  /** como aparece no painel */
  display: string;
  count: number;
  aliased: boolean;
}

/** Espaços colapsados e sem sobra nas pontas — "Rodrigo  Ribeiro " vira
 *  "Rodrigo Ribeiro". */
export function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** Chave de comparação: caixa e espaçamento não fazem duas pessoas. */
export function aliasKey(name: string): string {
  return cleanName(name).toLowerCase();
}

const TTL_MS = 30_000;
let cache: { map: AliasMap; at: number } | null = null;

/** Tabela ainda não migrada. O PostgREST responde PGRST205 (não achou no
 *  cache de schema); 42P01 é o erro cru do Postgres — aceita os dois. */
export function tableMissing(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return code === "PGRST205" || code === "42P01";
}

/** Mapa chave→nome de exibição, em cache curto (a tabela é minúscula e muda
 *  raramente, mas o painel faz poll a cada 5s). Fail-soft: se a migração
 *  ainda não rodou, segue com os nomes crus. */
export async function loadAliases(fresh = false): Promise<AliasMap> {
  if (!fresh && cache && Date.now() - cache.at < TTL_MS) return cache.map;
  const { data, error } = await db()
    .from("miner_aliases")
    .select("alias, display_name");
  if (error) {
    if (tableMissing(error)) {
      cache = { map: {}, at: Date.now() };
      return cache.map;
    }
    throw error;
  }
  const map: AliasMap = {};
  for (const row of data ?? []) {
    map[row.alias as string] = row.display_name as string;
  }
  cache = { map, at: Date.now() };
  return map;
}

/** Nome cru → nome de exibição. Sem apelido cadastrado, devolve o próprio
 *  nome limpo. */
export function resolveMiner(
  raw: string | null | undefined,
  map: AliasMap,
): string | null {
  if (!raw) return null;
  const cleaned = cleanName(raw);
  if (!cleaned) return null;
  return map[aliasKey(cleaned)] ?? cleaned;
}

/** Todo mundo que já minerou algo, com quantos links trouxe. Inclui apelidos
 *  cadastrados que ainda não têm link nenhum. */
export async function listMiners(): Promise<MinerRow[]> {
  const map = await loadAliases(true);
  const { data, error } = await db().from("links").select("added_by");
  if (error) throw error;

  const found = new Map<string, { raw: string; count: number }>();
  for (const row of data ?? []) {
    const raw = cleanName((row.added_by as string | null) ?? "");
    if (!raw) continue;
    const key = aliasKey(raw);
    const cur = found.get(key);
    if (cur) cur.count++;
    else found.set(key, { raw, count: 1 });
  }
  for (const key of Object.keys(map)) {
    if (!found.has(key)) found.set(key, { raw: key, count: 0 });
  }

  return [...found.entries()]
    .map(([key, v]) => ({
      key,
      raw: v.raw,
      display: map[key] ?? v.raw,
      count: v.count,
      aliased: key in map,
    }))
    .sort(
      (a, b) => b.count - a.count || a.display.localeCompare(b.display, "pt-BR"),
    );
}

/** Grava (ou remove, com displayName vazio) o apelido de um nome cru. */
export async function setAlias(
  rawOrKey: string,
  displayName: string | null,
): Promise<void> {
  const key = aliasKey(rawOrKey);
  if (!key) throw new Error("nome vazio");
  const display = displayName ? cleanName(displayName) : "";

  if (!display) {
    const { error } = await db()
      .from("miner_aliases")
      .delete()
      .eq("alias", key);
    if (error) throw error;
  } else {
    const { error } = await db()
      .from("miner_aliases")
      .upsert({
        alias: key,
        display_name: display,
        updated_at: new Date().toISOString(),
      });
    if (error) throw error;
  }
  cache = null;
}
