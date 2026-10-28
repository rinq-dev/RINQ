import { prisma } from "./prisma";
import { randomBytes } from "crypto";

export async function createWebAuthSession(): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 phút

  await prisma.webAuthSession.create({
    data: {
      token,
      isVerified: false,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function verifyWebAuthSession(
  token: string,
  user: { id: string; username?: string | null; firstName?: string | null; photoUrl?: string | null }
): Promise<boolean> {
  const session = await prisma.webAuthSession.findUnique({
    where: { token },
  });

  if (!session || session.expiresAt < new Date()) return false;

  await prisma.webAuthSession.update({
    where: { token },
    data: {
      isVerified: true,
      telegramId: String(user.id),
      username: user.username || null,
      firstName: user.firstName || null,
      photoUrl: user.photoUrl || null,
    },
  });

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
  const session = await prisma.webAuthSession.findUnique({
    where: { token },
  });

  if (!session || session.expiresAt < new Date()) {
    return { valid: false, expired: true };
  }

  if (session.isVerified) {
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
