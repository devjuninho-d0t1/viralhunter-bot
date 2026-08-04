/**
 * Classifica link de rede social: vídeo (o que interessa minerar) x perfil
 * (referência de conta, que o time manda às dezenas e não deve virar card).
 *
 * Regra de ouro: só devolve "profile" quando dá pra AFIRMAR que é perfil.
 * Link desconhecido vira "video" — errar pra menos (guardar algo que não era
 * vídeo) é bem menos grave do que engolir em silêncio um link que o time
 * queria salvar.
 */

export type LinkKind = "video" | "profile";

/** Primeiros segmentos do path, em minúsculas e sem vazios. */
function segments(u: URL): string[] {
  return u.pathname.split("/").filter(Boolean).map((s) => s.toLowerCase());
}

/** Segmentos que identificam conteúdo específico no Instagram. */
const IG_CONTENT = new Set(["reel", "reels", "p", "tv", "share", "stories"]);

function instagramKind(u: URL): LinkKind {
  const seg = segments(u);
  // instagram.com  →  home, não é perfil de ninguém
  if (seg.length === 0) return "video";

  // /reel/CODE, /p/CODE, /tv/CODE, /stories/user/ID …
  if (IG_CONTENT.has(seg[0])) {
    // /reels/ sozinho é a aba de reels, sem código de vídeo
    return seg.length >= 2 ? "video" : "profile";
  }

  // /usuario/reel/CODE também é um vídeo específico
  if (seg.length >= 3 && IG_CONTENT.has(seg[1])) return "video";

  // /usuario  e  /usuario/reels  (aba do perfil) → perfil
  return "profile";
}

function tiktokKind(u: URL, host: string): LinkKind {
  const seg = segments(u);
  // vm.tiktok.com/XXXX e afins são sempre atalho pra um vídeo
  if (host !== "tiktok.com") return "video";
  if (seg.length === 0) return "video";
  // /@usuario/video/123 → vídeo | /@usuario → perfil
  if (seg[0].startsWith("@")) return seg.length >= 2 ? "video" : "profile";
  return "video";
}

function youtubeKind(u: URL, host: string): LinkKind {
  const seg = segments(u);
  if (host === "youtu.be") return "video";
  if (seg.length === 0) return "video";
  if (seg[0] === "watch" || seg[0] === "shorts" || seg[0] === "live")
    return "video";
  // /@canal, /channel/ID, /c/nome, /user/nome → perfil
  if (
    seg[0].startsWith("@") ||
    seg[0] === "channel" ||
    seg[0] === "c" ||
    seg[0] === "user"
  ) {
    return "profile";
  }
  return "video";
}

export function classifyLink(raw: string): LinkKind {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return "video";
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, "");

  if (host === "instagram.com" || host.endsWith(".instagram.com"))
    return instagramKind(u);
  if (host === "tiktok.com" || host.endsWith(".tiktok.com"))
    return tiktokKind(u, host);
  if (
    host === "youtube.com" ||
    host.endsWith(".youtube.com") ||
    host === "youtu.be"
  ) {
    return youtubeKind(u, host);
  }
  return "video";
}

export function isProfileLink(raw: string): boolean {
  return classifyLink(raw) === "profile";
}
