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

export const WELCOME = `👋 *Olá! Eu sou o organizador de links do time.*

Meu trabalho é simples: você me manda links, eu guardo tudo organizado em pastas.

*Pra começar agora:*
📥 Cole qualquer link no chat → eu salvo na pasta *inbox*
📁 Cole o link com *#nomedapasta* → eu salvo na pasta certa

Exemplo:
\`https://instagram.com/reel/abc #ads\`

📊 Tudo que entra aqui aparece ao vivo no *painel do time*:
https://b2b-minerador.vercel.app

Digite /help pra ver o guia completo de comandos. 🚀`;

const HELP = `📖 *Guia completo — passo a passo*

*1️⃣ Salvar um link*
É só colar no chat, sem comando nenhum.
→ Vai pra pasta *inbox*.

*2️⃣ Salvar direto numa pasta*
Cole o link e adicione *#nome* na mensagem:
\`https://... #ads\`
→ Salvo em *ads*. Se a pasta não existir, eu crio na hora.

*3️⃣ /criar [nome]* — cria uma pasta vazia
Ex: \`/criar criativos\`

*4️⃣ /pastas* — lista todas as pastas
Mostra também quantos links tem em cada uma.

*5️⃣ /links [pasta]* — mostra o que tem numa pasta
Ex: \`/links ads\` → lista os 30 links mais recentes.

*6️⃣ /renomear [antigo] > [novo]* — renomeia uma pasta
Ex: \`/renomear ads > ads-frios\`
Os links vão junto, nada se perde.

*7️⃣ /apagar [nome]* — apaga a pasta E os links dela
Ex: \`/apagar rascunho\`
⚠️ Não tem desfazer. A *inbox* é protegida, não pode ser apagada.

*📊 Painel ao vivo*
Tudo que o time salva aqui fica organizado em tempo real no painel:
https://b2b-minerador.vercel.app
_A senha está com o time._

Mensagens sem link e sem comando eu ignoro — pode conversar à vontade. 😉
/help — mostra este guia de novo`;

const FOLDER_NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} ._-]{0,29}$/u;

function invalidFolderName(name: string): string | null {
  if (FOLDER_NAME_RE.test(name.trim())) return null;
  return "Nome de pasta inválido. Use letras, números, espaço, ponto, hífen ou _ (máx. 30 caracteres).";
}

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
      case "/start":
        return WELCOME;

      case "/ajuda":
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
        const invalid = invalidFolderName(arg);
        if (invalid) return invalid;
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
        const invalid = invalidFolderName(parts[1]);
        if (invalid) return invalid;
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
        return `🔗 *${arg.toLowerCase()}* (${links.length} mais recentes):\n` + lines.join("\n");
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
