import { NextRequest } from "next/server";
import { handleMessage } from "@/lib/commands";

/**
 * Transporte: Telegram (fase de testes).
 * A migração pro WhatsApp = criar app/api/zapi/route.ts com o mesmo
 * handleMessage() — o núcleo não muda.
 */

async function reply(
  chatId: number | string,
  text: string,
  replyTo?: number,
): Promise<void> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    disable_web_page_preview: true,
  };
  if (replyTo !== undefined) body.reply_to_message_id = replyTo;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      console.error("telegram sendMessage failed", res.status);
    }
  } catch (err) {
    console.error("telegram sendMessage error", err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const secret = request.headers.get("x-telegram-bot-api-secret-token");
    if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    const update = await request.json();
    const msg = update.message ?? update.channel_post;
    const text: string | undefined = msg?.text ?? msg?.caption;
    if (!msg || !text) return new Response("OK", { status: 200 });

    const userName: string =
      msg.from?.username ?? msg.from?.first_name ?? "desconhecido";

    const answer = await handleMessage({ text, userName });
    if (answer) {
      await reply(msg.chat.id, answer, msg.message_id);
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("telegram webhook error:", err);
    return new Response("OK", { status: 200 }); // 200 sempre: Telegram re-entrega em erro
  }
}
