import { prisma } from "./prisma";
import { randomBytes, createHash, createHmac } from "crypto";

export async function initWebAuthTable() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS WebAuthSession (
        token TEXT PRIMARY KEY,
        telegramId TEXT,
        username TEXT,
        firstName TEXT,
        photoUrl TEXT,
        isVerified INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        expiresAt DATETIME NOT NULL
      )
    `);
  } catch (error) {
    console.error("Lỗi khởi tạo bảng WebAuthSession:", error);
  }
}

export async function createWebAuthSession(): Promise<{ token: string; expiresAt: Date }> {
  await initWebAuthTable();
  const token = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 phút

  await prisma.$executeRawUnsafe(
    `INSERT INTO WebAuthSession (token, isVerified, expiresAt) VALUES (?, 0, ?)`,
    token,
    expiresAt.toISOString()
  );

  return { token, expiresAt };
}

export async function verifyWebAuthSession(
  token: string,
  user: { id: string; username?: string | null; firstName?: string | null; photoUrl?: string | null }
): Promise<boolean> {
  await initWebAuthTable();
  const now = new Date().toISOString();

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT token FROM WebAuthSession WHERE token = ? AND expiresAt > ?`,
    token,
    now
  );

  if (rows.length === 0) return false;

  await prisma.$executeRawUnsafe(
    `UPDATE WebAuthSession SET isVerified = 1, telegramId = ?, username = ?, firstName = ?, photoUrl = ? WHERE token = ?`,
    String(user.id),
    user.username || null,
    user.firstName || null,
    user.photoUrl || null,
    token
  );

  // Lưu hoặc cập nhật TelegramUser
  try {
    await prisma.telegramUser.upsert({
      where: { id: String(user.id) },
      update: {
        username: user.username || null,
        firstName: user.firstName || null,
      },
      create: {
        id: String(user.id),
        username: user.username || null,
        firstName: user.firstName || null,
      },
    });
  } catch (e) {
    console.warn("Lỗi lưu TelegramUser:", e);
  }

  return true;
}

export async function checkWebAuthSession(token: string) {
  await initWebAuthTable();
  const now = new Date().toISOString();

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM WebAuthSession WHERE token = ? AND expiresAt > ?`,
    token,
    now
  );

  if (rows.length === 0) {
    return { valid: false, expired: true };
  }

  const session = rows[0];
  if (session.isVerified === 1) {
    return {
      valid: true,
      verified: true,
      user: {
        id: session.telegramId ? Number(session.telegramId) : null,
        telegramId: session.telegramId,
        username: session.username || null,
        first_name: session.firstName || "",
        photo_url: session.photoUrl || null,
      },
    };
  }

  return { valid: true, verified: false };
}
