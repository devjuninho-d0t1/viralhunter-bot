/**
 * Sessão da plataforma — senha única do time.
 * Cookie httpOnly com token derivado (SHA-256) do SESSION_SECRET.
 * Web Crypto puro: funciona em route handler e em middleware.
 */

export const SESSION_COOKIE = "vh_session";

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function sessionToken(): Promise<string> {
  return sha256Hex(`viralhunter:${process.env.SESSION_SECRET}`);
}

export async function isValidSession(
  cookieValue: string | undefined,
): Promise<boolean> {
  if (!cookieValue || !process.env.SESSION_SECRET) return false;
  return cookieValue === (await sessionToken());
}

/**
 * Credencial da extensão do Chrome. É derivada do mesmo segredo, mas com
 * prefixo próprio: a extensão guarda esse valor em disco e não pode carregar
 * o cookie de sessão (httpOnly), então os dois nunca se misturam.
 */
export async function extensionToken(): Promise<string> {
  return sha256Hex(`viralhunter-ext:${process.env.SESSION_SECRET}`);
}

export async function isValidExtensionToken(
  token: string | undefined | null,
): Promise<boolean> {
  if (!token || !process.env.SESSION_SECRET) return false;
  return token === (await extensionToken());
}

/** Aceita o cookie do painel ou o token da extensão (header Authorization). */
export async function isAuthorizedRequest(request: {
  cookies: { get(name: string): { value: string } | undefined };
  headers: { get(name: string): string | null };
}): Promise<boolean> {
  if (await isValidSession(request.cookies.get(SESSION_COOKIE)?.value))
    return true;
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  return isValidExtensionToken(bearer);
}

export async function isValidPassword(
  password: string,
): Promise<boolean> {
  const expected = process.env.PLATFORM_PASSWORD;
  if (!expected || !password) return false;
  // compara por hash pra não vazar timing do ===
  return (
    (await sha256Hex(password)) === (await sha256Hex(expected))
  );
}
