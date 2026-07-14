import { NextRequest } from "next/server";
import { handleMessage } from "@/lib/commands";
import { parseZapiPayload, sendWhatsApp } from "@/lib/zapi";

/**
 * Transporte: WhatsApp via Z-API — PRONTO, só preencher as chaves.
 * Migração (ver README.md): preencher ZAPI_* no .env/Vercel e apontar o
 * webhook "Ao receber" da instância pra
 *   https://<app>.vercel.app/api/zapi?secret=<ZAPI_WEBHOOK_SECRET>
 */
export async function POST(request: NextRequest) {
  try {
    // Z-API não assina webhooks — protegemos com secret na query string
    const secret = request.nextUrl.searchParams.get("secret");
    if (
      !process.env.ZAPI_WEBHOOK_SECRET ||
      secret !== process.env.ZAPI_WEBHOOK_SECRET
    ) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = parseZapiPayload(body);
    if (!parsed) return new Response("OK", { status: 200 });

    // Trava opcional: só responde no(s) chat(s) autorizados (grupo do time)
    const allowed = process.env.ZAPI_ALLOWED_CHATS;
    if (allowed) {
      const ids = allowed.split(",").map((s) => s.trim());
      if (!ids.includes(parsed.chatId)) {
        return new Response("OK", { status: 200 });
      }
    }

    const answer = await handleMessage({
      text: parsed.text,
      userName: parsed.userName,
    });
    if (answer) {
      // *negrito* do núcleo renderiza nativamente no WhatsApp
      await sendWhatsApp(parsed.chatId, answer);
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("zapi webhook error:", err);
    return new Response("OK", { status: 200 });
  }
}
