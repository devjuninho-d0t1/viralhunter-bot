import {
  addLink,
  createFolder,
  deleteFolder,
  getFolder,
  listFolders,
  listLinks,
  renameFolder,
} from "@/lib/store";
import { sendToPlatform } from "@/lib/platform";

export interface IncomingMessage {
  text: string;
  userName: string;
}

const HELP = `📁 *B2B Minerador — comandos*

Mandar link → cai na pasta *inbox*
Mandar link com #pasta → cai na pasta (ex: \`https://... #ads\`)

/pastas — lista as pastas
/criar <nome> — cria pasta
/apagar <nome> — apaga pasta (e os links dela)
/renomear <antigo> > <novo> — renomeia
/links <pasta> — lista os links da pasta
/ajuda — este menu`;

export function extractUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/);
  return match ? match[0] : null;
}

export function extractFolderTag(text: string): string | null {
  // remove URLs antes, pra não pegar #fragment de URL
  const withoutUrls = text.replace(/https?:\/\/[^\s]+/g, " ");
  const match = withoutUrls.match(/#([\p{L}\p{N}_-]+)/u);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Núcleo transport-agnóstico: recebe texto de qualquer canal
 * (Telegram hoje, Z-API/WhatsApp depois) e devolve a resposta,
 * ou null para ignorar em silêncio.
 */
export async function handleMessage(
  msg: IncomingMessage,
): Promise<string | null> {
  const text = msg.text.trim();
  if (!text) return null;

  // ── Comandos ──
  if (text.startsWith("/")) {
    const [cmd, ...rest] = text.split(/\s+/);
    const arg = rest.join(" ").trim();
    const command = cmd.toLowerCase().replace(/@\S+$/, ""); // tira @nomedobot

    switch (command) {
      case "/ajuda":
      case "/start":
      case "/help":
        return HELP;

      case "/pastas": {
        const folders = await listFolders();
        if (folders.length === 0) return "Nenhuma pasta ainda. Use /criar <nome>.";
        return (
          "📁 *Pastas:*\n" +
          folders.map((f) => `• ${f.name} (${f.count})`).join("\n")
        );
      }

      case "/criar": {
        if (!arg) return "Uso: /criar <nome da pasta>";
        const existing = await getFolder(arg);
        if (existing) return `A pasta *${existing.name}* já existe.`;
        const folder = await createFolder(arg, msg.userName);
        return `✅ Pasta *${folder.name}* criada.`;
      }

      case "/apagar": {
        if (!arg) return "Uso: /apagar <nome da pasta>";
        if (arg.toLowerCase() === "inbox")
          return "A pasta *inbox* é padrão e não pode ser apagada.";
        const ok = await deleteFolder(arg);
        return ok
          ? `🗑 Pasta *${arg.toLowerCase()}* apagada (links incluídos).`
          : `Pasta *${arg.toLowerCase()}* não encontrada. Veja /pastas.`;
      }

      case "/renomear": {
        const parts = arg.split(/\s*(?:>|→| para )\s*/i);
        if (parts.length !== 2 || !parts[0] || !parts[1])
          return "Uso: /renomear <antigo> > <novo>";
        if (parts[0].trim().toLowerCase() === "inbox")
          return "A pasta *inbox* é padrão e não pode ser renomeada.";
        const ok = await renameFolder(parts[0], parts[1]);
        return ok
          ? `✏️ *${parts[0].trim().toLowerCase()}* → *${parts[1].trim().toLowerCase()}*`
          : `Pasta *${parts[0].trim().toLowerCase()}* não encontrada. Veja /pastas.`;
      }

      case "/links": {
        if (!arg) return "Uso: /links <pasta>";
        const links = await listLinks(arg);
        if (links === null)
          return `Pasta *${arg.toLowerCase()}* não encontrada. Veja /pastas.`;
        if (links.length === 0) return `Pasta *${arg.toLowerCase()}* está vazia.`;
        return (
          `🔗 *${arg.toLowerCase()}* (${links.length} mais recentes):\n` +
          links.map((l) => `• ${l.url}`).join("\n")
        );
      }

      default:
        return null; // comando desconhecido: silêncio (pode ser de outro bot)
    }
  }

  // ── Link solto ──
  const url = extractUrl(text);
  if (!url) return null; // mensagem sem link e sem comando: ignora

  const folderName = extractFolderTag(text) ?? "inbox";
  const { folder, linkId } = await addLink(url, folderName, msg.userName, text);

  // dispara pro adapter da plataforma (stub até o Felipe definir)
  sendToPlatform({ url, folder: folder.name, linkId }).catch((err) =>
    console.error("sendToPlatform error:", err),
  );

  return `📥 Salvo em *${folder.name}* (#${linkId}).`;
}
