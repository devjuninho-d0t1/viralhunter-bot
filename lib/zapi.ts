/**
 * Parsing e envio Z-API (WhatsApp).
 *
 * Payload confirmado na doc oficial (developer.z-api.io › webhooks ›
 * on-message-received-examples):
 *   { type: "ReceivedCallback", text: { message }, phone, isGroup,
 *     participantPhone, senderName, fromMe }
 * Em grupo: `phone` é o id do grupo e `participantPhone` é quem mandou.
 */

export interface ZapiParsed {
  text: string;
  chatId: string;
  userName: string;
  messageId: string | null;
}

export function parseZapiPayload(
  body: Record<string, unknown> | null,
): ZapiParsed | null {
  if (!body) return null;
  if (body.type !== "ReceivedCallback") return null; // status/entrega/etc
  // Anti-loop: ignora o que foi enviado PELA API (respostas do próprio bot).
  // fromMe sozinho não serve: se o número do bot for de uma pessoa (ex: teste
  // com número pessoal), as mensagens digitadas por ela têm fromMe=true mas
  // fromApi=false — e devem ser processadas normalmente.
  if (body.fromApi === true) return null;
  if (body.fromMe === true && body.fromApi === undefined) return null; // payload antigo sem fromApi: volta ao comportamento seguro
  const text = (body.text as { message?: string } | undefined)?.message;
  const chatId = body.phone as string | undefined; // grupo ou 1:1
  if (!text || !chatId) return null;
  const userName =
    (body.senderName as string | undefined) ??
    (body.participantPhone as string | undefined) ??
    chatId;
  const messageId = (body.messageId as string | undefined) ?? null;
  return { text, chatId, userName, messageId };
}

export async function sendWhatsApp(
  phone: string,
  text: string,
): Promise<void> {
  const { ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN } = process.env;
  if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN) {
    console.error("Z-API não configurada (ZAPI_INSTANCE_ID/ZAPI_TOKEN)");
    return;
  }
  try {
    const res = await fetch(
      `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(ZAPI_CLIENT_TOKEN ? { "Client-Token": ZAPI_CLIENT_TOKEN } : {}),
        },
        body: JSON.stringify({ phone, message: text }),
      },
    );
    if (!res.ok) {
      console.error(
        "zapi send-text failed",
        res.status,
        await res.text().catch(() => ""),
      );
    }
  } catch (err) {
    console.error("zapi send-text error", err);
  }
}

/** Reage a uma mensagem com um emoji (ex: ⛏️ = "minerado e salvo"). */
export async function sendReaction(
  phone: string,
  messageId: string,
  reaction: string,
): Promise<void> {
  const { ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN } = process.env;
  if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN) return;
  try {
    const res = await fetch(
      `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-message-reaction`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(ZAPI_CLIENT_TOKEN ? { "Client-Token": ZAPI_CLIENT_TOKEN } : {}),
        },
        body: JSON.stringify({ phone, messageId, reaction }),
      },
    );
    if (!res.ok) {
      console.error(
        "zapi send-reaction failed",
        res.status,
        await res.text().catch(() => ""),
      );
    }
  } catch (err) {
    console.error("zapi send-reaction error", err);
  }
}
