import { createHash, createHmac, timingSafeEqual } from "crypto";

export function verifyTelegramInitData(initData: string) {
  const botToken = process.env.BOT_TOKEN;
  if (!botToken || !initData || initData.length > 8192) return null;

  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash") || "";
  const authDate = Number(params.get("auth_date"));
  const now = Math.floor(Date.now() / 1000);
  if (!/^[a-f0-9]{64}$/i.test(receivedHash) || !Number.isSafeInteger(authDate) || authDate > now + 60 || now - authDate > 86400) {
    return null;
  }

  const userRaw = params.get("user");
  if (!userRaw) return null;

  const entries = [...params.entries()];
  if (new Set(entries.map(([key]) => key)).size !== entries.length) return null;

  const checkString = entries
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expectedHash = createHmac("sha256", secretKey).update(checkString).digest();
  const suppliedHash = Buffer.from(receivedHash, "hex");
  if (expectedHash.length !== suppliedHash.length || !timingSafeEqual(expectedHash, suppliedHash)) return null;

  try {
    const user = JSON.parse(userRaw);
    return Number.isSafeInteger(user.id) && user.id > 0 ? { id: String(user.id), user } : null;
  } catch {
    return null;
  }
}

export function verifyTelegramWidgetData(data: Record<string, any>) {
  const botToken = process.env.BOT_TOKEN;
  if (!botToken || !data || !data.hash) return null;

  const receivedHash = String(data.hash);
  if (!/^[a-f0-9]{64}$/i.test(receivedHash)) return null;

  const authDate = Number(data.auth_date);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(authDate) || authDate > now + 60 || now - authDate > 86400) {
    return null;
  }

  const checkString = Object.keys(data)
    .filter((k) => k !== "hash" && data[k] !== undefined && data[k] !== null)
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join("\n");

  const secretKey = createHash("sha256").update(botToken).digest();
  const expectedHash = createHmac("sha256", secretKey).update(checkString).digest();
  const suppliedHash = Buffer.from(receivedHash, "hex");

  if (expectedHash.length !== suppliedHash.length || !timingSafeEqual(expectedHash, suppliedHash)) {
    return null;
  }

  const userId = Number(data.id);
  if (!Number.isSafeInteger(userId) || userId <= 0) return null;

  return {
    id: String(userId),
    username: data.username ? String(data.username).replace(/^@/, "") : null,
    firstName: data.first_name ? String(data.first_name) : null,
    photoUrl: data.photo_url ? String(data.photo_url) : null,
  };
}
