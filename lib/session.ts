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
