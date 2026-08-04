import {
  addLink,
  createFolder,
  deleteFolder,
  findLinkByUrl,
  getFolder,
  listFolders,
  listLinks,
  renameFolder,
} from "@/lib/store";
import { sendToPlatform } from "@/lib/platform";
import { isProfileLink } from "@/lib/linkkind";

export interface IncomingMessage {
  text: string;
  userName: string;
}

/**
 * Resposta do núcleo. A reação vem separada do texto de propósito: antes o
 * transporte adivinhava a reação pelo emoji que abria a mensagem, e qualquer
 * mudança de copy quebrava isso em silêncio.
 */
export interface Reply {
  text: string;
  reaction?: "mined" | "duplicate";
}

export const WELCOME = `*Organizador de links do time*

Você manda os links, eu guardo tudo organizado em pastas.

*Como usar*
• Cole qualquer link no chat — salvo na pasta *inbox*
• Cole com *#nomedapasta* — salvo na pasta certa
• Mande vários de uma vez — minero todos
• Link de perfil eu ignoro: só guardo vídeo

Exemplo:
\`https://instagram.com/reel/abc #ads\`

Tudo que entra aqui aparece ao vivo no painel do time:
https://b2b-minerador.vercel.app

Digite /ajuda para o guia completo.`;

const HELP = `*Guia completo*

*1. Salvar um link*
Cole no chat, sem comando nenhum. Vai para a pasta *inbox*.

*2. Salvar direto numa pasta*
Cole o link com *#nome* na mensagem:
\`https://... #ads\`
Salvo em *ads*. Se a pasta não existir, eu crio na hora.

*3. Deixar um insight junto*
Escreva o comentário na mesma mensagem do link:
\`https://... #ads gancho forte nos 3 primeiros segundos\`
O texto vira anotação do vídeo no painel.

*4. Vários links de uma vez*
Cole quantos quiser, um por linha — minero todos.
O comentário vale para o link da *mesma linha*, então dá para
anotar cada vídeo separadamente numa mensagem só.

*5. Perfil eu não guardo*
\`instagram.com/fulano\` é referência de conta, não vídeo.
Esses eu ignoro e aviso quantos deixei passar. Só entra
reel, post, short e equivalentes.

*Comandos*
\`/criar [nome]\` — cria uma pasta vazia
\`/pastas\` — lista as pastas e quantos links tem em cada
\`/links [pasta]\` — mostra os 30 links mais recentes da pasta
\`/renomear [antigo] > [novo]\` — renomeia (os links vão junto)
\`/apagar [nome]\` — apaga a pasta e os links dela, sem desfazer.
A *inbox* é protegida.

*Painel ao vivo*
https://b2b-minerador.vercel.app
_A senha está com o time._

Mensagens sem link e sem comando eu ignoro.
/ajuda — mostra este guia de novo`;

const FOLDER_NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} ._-]{0,29}$/u;

function invalidFolderName(name: string): string | null {
  if (FOLDER_NAME_RE.test(name.trim())) return null;
  return "Nome de pasta inválido. Use letras, números, espaço, ponto, hífen ou _ (máx. 30 caracteres).";
}

export function extractUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/);
  return match ? match[0] : null;
}

/** Todos os links da mensagem, na ordem, sem repetir. */
export function extractUrls(text: string): string[] {
  const found = text.match(/https?:\/\/[^\s]+/g) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of found) {
    // pontuação colada no fim do link ("...abc)." ) não faz parte da URL
    const url = raw.replace(/[)\]}>.,;!?]+$/, "");
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

/**
 * Insight de cada link numa mensagem com vários.
 *
 * O time manda um link por linha e comenta na própria linha — foi assim que
 * "(nosso aliado mas pode pegar algumas ideias dele tbm)" acabou grudado no
 * link errado. Então o comentário vale para os links da MESMA linha.
 */
export function extractNotesByUrl(
  text: string,
  folderTag: string | null,
): Map<string, string> {
  const notes = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const urls = extractUrls(line);
    if (urls.length === 0) continue;
    const note = extractNote(line, folderTag);
    if (!note) continue;
    for (const url of urls) notes.set(url, note);
  }
  return notes;
}

export function extractFolderTag(text: string): string | null {
  // remove URLs antes, pra não pegar #fragment de URL
  const withoutUrls = text.replace(/https?:\/\/[^\s]+/g, " ");
  const match = withoutUrls.match(/#([\p{L}\p{N}_-]+)/u);
  return match ? match[1].toLowerCase() : null;
}

/** O que sobra da mensagem sem a URL e sem a #pasta vira insight do vídeo. */
export function extractNote(text: string, folderTag: string | null): string | null {
  let rest = text.replace(/https?:\/\/[^\s]+/g, " ");
  if (folderTag) rest = rest.replace(new RegExp(`#${folderTag}\\b`, "iu"), " ");
  const note = rest.replace(/\s+/g, " ").trim();
  return note || null;
}

const say = (text: string): Reply => ({ text });

/**
 * Núcleo transport-agnóstico: recebe texto de qualquer canal e devolve a
 * resposta, ou null para ignorar em silêncio.
 */
export async function handleMessage(
  msg: IncomingMessage,
): Promise<Reply | null> {
  const text = msg.text.trim();
  if (!text) return null;

  // ── Comandos ──
  if (text.startsWith("/")) {
    const [cmd, ...rest] = text.split(/\s+/);
    const arg = rest.join(" ").trim();
    const command = cmd.toLowerCase().replace(/@\S+$/, ""); // tira @nomedobot

    switch (command) {
      case "/start":
        return say(WELCOME);

      case "/ajuda":
      case "/help":
        return say(HELP);

      case "/pastas": {
        const folders = await listFolders();
        if (folders.length === 0)
          return say("Nenhuma pasta ainda. Use /criar <nome>.");
        return say(
          "*Pastas*\n" +
            folders.map((f) => `• ${f.name} (${f.count})`).join("\n"),
        );
      }

      case "/criar": {
        if (!arg) return say("Uso: /criar <nome da pasta>");
        const invalid = invalidFolderName(arg);
        if (invalid) return say(invalid);
        const existing = await getFolder(arg);
        if (existing) return say(`A pasta *${existing.name}* já existe.`);
        const folder = await createFolder(arg, msg.userName);
        return say(`Pasta *${folder.name}* criada.`);
      }

      case "/apagar": {
        if (!arg) return say("Uso: /apagar <nome da pasta>");
        if (arg.toLowerCase() === "inbox")
          return say("A pasta *inbox* é padrão e não pode ser apagada.");
        const ok = await deleteFolder(arg);
        return say(
          ok
            ? `Pasta *${arg.toLowerCase()}* apagada, com os links dela.`
            : `Pasta *${arg.toLowerCase()}* não encontrada. Veja /pastas.`,
        );
      }

      case "/renomear": {
        const parts = arg.split(/\s*(?:>|→| para )\s*/i);
        if (parts.length !== 2 || !parts[0] || !parts[1])
          return say("Uso: /renomear <antigo> > <novo>");
        if (parts[0].trim().toLowerCase() === "inbox")
          return say("A pasta *inbox* é padrão e não pode ser renomeada.");
        const invalid = invalidFolderName(parts[1]);
        if (invalid) return say(invalid);
        const ok = await renameFolder(parts[0], parts[1]);
        return say(
          ok
            ? `Pasta *${parts[0].trim().toLowerCase()}* renomeada para *${parts[1].trim().toLowerCase()}*.`
            : `Pasta *${parts[0].trim().toLowerCase()}* não encontrada. Veja /pastas.`,
        );
      }

      case "/links": {
        if (!arg) return say("Uso: /links <pasta>");
        const links = await listLinks(arg);
        if (links === null)
          return say(`Pasta *${arg.toLowerCase()}* não encontrada. Veja /pastas.`);
        if (links.length === 0)
          return say(`Pasta *${arg.toLowerCase()}* está vazia.`);
        // Telegram/WhatsApp limitam o tamanho da mensagem — corta antes de estourar
        const lines: string[] = [];
        let size = 0;
        for (const l of links) {
          const line = `• ${l.url}`;
          if (size + line.length > 3000) {
            lines.push(`… e mais ${links.length - lines.length} link(s).`);
            break;
          }
          lines.push(line);
          size += line.length + 1;
        }
        return say(
          `*${arg.toLowerCase()}* — ${links.length} mais recentes:\n` +
            lines.join("\n"),
        );
      }

      default:
        return null; // comando desconhecido: silêncio (pode ser de outro bot)
    }
  }

  // ── Link(s) na mensagem ──
  const urls = extractUrls(text);
  if (urls.length === 0) return null; // sem link e sem comando: ignora

  const tag = extractFolderTag(text);
  const folderName = tag ?? "inbox";

  // Uma mensagem só costuma ter o comentário solto em qualquer posição; com
  // vários links, o comentário é o da linha de cada um.
  const noteFor =
    urls.length === 1
      ? new Map([[urls[0], extractNote(text, tag)]].filter(
          (e): e is [string, string] => e[1] !== null,
        ))
      : extractNotesByUrl(text, tag);

  const salvos: { id: number; folder: string; note: boolean }[] = [];
  const repetidos: { id: number; folder: string }[] = [];
  let perfis = 0;

  for (const url of urls) {
    // referência de conta não vira card — o time manda essas aos montes
    if (isProfileLink(url)) {
      perfis++;
      continue;
    }

    const dup = await findLinkByUrl(url);
    if (dup) {
      repetidos.push(dup);
      continue;
    }

    const note = noteFor.get(url) ?? null;
    const { folder, linkId } = await addLink(
      url,
      folderName,
      msg.userName,
      text,
      note,
    );
    salvos.push({ id: linkId, folder: folder.name, note: !!note });

    // dispara pro adapter da plataforma (stub até o Felipe definir)
    sendToPlatform({ url, folder: folder.name, linkId }).catch((err) =>
      console.error("sendToPlatform error:", err),
    );
  }

  return resumo(salvos, repetidos, perfis);
}

/** Resposta do bot para uma mensagem com links. A reação vai no campo
 *  próprio, não é deduzida do texto. */
function resumo(
  salvos: { id: number; folder: string; note: boolean }[],
  repetidos: { id: number; folder: string }[],
  perfis: number,
): Reply | null {
  const linhas: string[] = [];

  if (salvos.length === 1) {
    const s = salvos[0];
    linhas.push(
      `Salvo em *${s.folder}* (#${s.id}).${s.note ? " Insight anotado." : ""}`,
    );
  } else if (salvos.length > 1) {
    const pastas = [...new Set(salvos.map((s) => s.folder))];
    const comNota = salvos.filter((s) => s.note).length;
    linhas.push(
      `*${salvos.length} vídeos* minerados em *${pastas.join(", ")}* ` +
        `(${salvos.map((s) => `#${s.id}`).join(", ")}).` +
        (comNota ? ` ${comNota} com insight.` : ""),
    );
  }

  if (repetidos.length === 1) {
    const r = repetidos[0];
    linhas.push(`1 já tinha sido minerado, está em *${r.folder}* (#${r.id}).`);
  } else if (repetidos.length > 1) {
    linhas.push(`${repetidos.length} já tinham sido minerados.`);
  }

  if (perfis > 0) {
    const plural = perfis > 1;
    linhas.push(
      `${perfis} link${plural ? "s" : ""} de perfil ignorado${plural ? "s" : ""} — só guardo vídeo (reel, post, short).`,
    );
  }

  if (linhas.length === 0) return null;

  return {
    text: linhas.join("\n"),
    reaction:
      salvos.length > 0
        ? "mined"
        : repetidos.length > 0
          ? "duplicate"
          : undefined,
  };
}
