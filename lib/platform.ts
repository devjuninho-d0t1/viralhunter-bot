/**
 * Adapter da plataforma de destino — A DEFINIR (Felipe).
 *
 * Quando a plataforma existir, implemente aqui o envio real
 * (HTTP POST, SDK, etc.) e marque links.sent_to_platform = true.
 * O resto do bot não muda: handleMessage() já chama sendToPlatform()
 * a cada link salvo.
 */
export interface PlatformPayload {
  url: string;
  folder: string;
  linkId: number;
}

export async function sendToPlatform(
  payload: PlatformPayload,
): Promise<void> {
  const endpoint = process.env.PLATFORM_WEBHOOK_URL;
  if (!endpoint) {
    // plataforma ainda não configurada — no-op silencioso
    return;
  }
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`platform webhook failed: ${res.status}`);
  }
}
