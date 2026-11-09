import { prisma } from "./prisma";
import { randomBytes } from "crypto";

export const CUSTOMER_SESSION_COOKIE = "rinq_customer_session";
const CUSTOMER_SESSION_SECONDS = 60 * 60 * 24 * 30;

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

  const sessionToken = session.sessionToken || randomBytes(32).toString("hex");
  const claimed = await prisma.$transaction(async (tx) => {
    const result = await tx.webAuthSession.updateMany({
      where: { token, isVerified: false, expiresAt: { gt: new Date() } },
      data: {
        isVerified: true,
        telegramId: String(user.id),
        username: user.username || null,
        firstName: user.firstName || null,
        photoUrl: user.photoUrl || null,
        sessionToken,
      },
    });
    if (result.count !== 1) return false;

    await tx.customerSession.upsert({
      where: { token: sessionToken },
      update: {
        telegramId: String(user.id),
        username: user.username || null,
        firstName: user.firstName || null,
        expiresAt: new Date(Date.now() + CUSTOMER_SESSION_SECONDS * 1000),
      },
      create: {
        token: sessionToken,
        telegramId: String(user.id),
        username: user.username || null,
        firstName: user.firstName || null,
        expiresAt: new Date(Date.now() + CUSTOMER_SESSION_SECONDS * 1000),
      },
    });
    return true;
  });
  if (!claimed) return false;

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
      sessionToken: session.sessionToken,
    };
  }

  return { valid: true, verified: false };
}

export async function checkCustomerSession(token?: string | null) {
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) return null;
  const session = await prisma.customerSession.findUnique({ where: { token } });
  if (!session || session.expiresAt <= new Date()) return null;
  return {
    id: Number(session.telegramId) || session.telegramId,
    telegramId: session.telegramId,
    username: session.username,
    first_name: session.firstName || "",
  };
}

export function customerSessionCookieOptions(expiresAt?: Date) {
  return {
    name: CUSTOMER_SESSION_COOKIE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: expiresAt ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)) : CUSTOMER_SESSION_SECONDS,
  };
}
