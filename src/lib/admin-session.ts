const COOKIE_NAME = "rinq_admin_session";
const SESSION_SECONDS = 60 * 60 * 8;

function sessionKey() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET must contain at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sign(payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    sessionKey(),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))));
}

export async function createAdminSession() {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify({ exp: expiresAt })));
  return `${payload}.${await sign(payload)}`;
}

export async function isValidAdminSession(token?: string | null) {
  if (!token) return false;
  try {
    const [payload, suppliedSignature, ...extra] = token.split(".");
    if (!payload || !suppliedSignature || extra.length) return false;
    if (!crypto.subtle.verify) return false;
    const key = await crypto.subtle.importKey(
      "raw",
      sessionKey(),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const signatureBytes = Uint8Array.from(atob(suppliedSignature.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - suppliedSignature.length % 4) % 4)), (c) => c.charCodeAt(0));
    const payloadBytes = new TextEncoder().encode(payload);
    if (!(await crypto.subtle.verify("HMAC", key, signatureBytes, payloadBytes))) return false;
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - payload.length % 4) % 4));
    const claims = JSON.parse(decoded);
    return Number.isSafeInteger(claims.exp) && claims.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function adminCookieOptions() {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: SESSION_SECONDS,
  };
}

export { COOKIE_NAME };
