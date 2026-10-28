import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const SECRET = process.env.STOCK_ENCRYPTION_KEY;
if (!SECRET || SECRET.length < 32) {
  throw new Error("STOCK_ENCRYPTION_KEY must be configured with at least 32 characters");
}
const KEYS = [SECRET, ...(process.env.STOCK_ENCRYPTION_KEY_PREVIOUS || "").split(",")]
  .map((secret) => secret.trim())
  .filter(Boolean)
  .map((secret) => crypto.scryptSync(secret, "rinq_stock_salt", 32));
const CURRENT_KEY = KEYS[0];

/**
 * Mã hóa nội dung kho hàng (Account / Key / Link)
 */
export function encryptStock(text: string): string {
  if (!text) return text;
  // Tránh mã hóa lặp 2 lần nếu đã là chuỗi mã hóa
  if (text.startsWith("enc:v1:")) return text;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, CURRENT_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return `enc:v1:${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Giải mã nội dung kho hàng. Tương thích ngược dữ liệu cũ dạng plaintext.
 */
export function decryptStock(text: string): string {
  if (!text) return text;
  if (!text.startsWith("enc:v1:")) {
    // Dữ liệu cũ dạng plaintext, giữ nguyên
    return text;
  }

  try {
    const parts = text.split(":");
    if (parts.length !== 5) throw new Error("Malformed encrypted stock value");

    const iv = Buffer.from(parts[2], "hex");
    const authTag = Buffer.from(parts[3], "hex");
    const encryptedHex = parts[4];

    for (const key of KEYS) {
      try {
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        return decipher.update(encryptedHex, "hex", "utf8") + decipher.final("utf8");
      } catch {
        // Try the next configured key during a controlled key rotation.
      }
    }
    throw new Error("No configured stock key could decrypt this item");
  } catch (error) {
    console.error("Lỗi giải mã stock item");
    throw error;
  }
}

