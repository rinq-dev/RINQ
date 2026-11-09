import type { NextRequest } from "next/server";
import { verifyTelegramInitData } from "./telegram-auth";
import { checkCustomerSession, CUSTOMER_SESSION_COOKIE } from "./web-auth";

/** Resolve customer identity and profile fields only from Telegram-verified credentials. */
export async function getAuthenticatedTelegramUser(req: NextRequest) {
  const initData = req.headers.get("x-telegram-init-data") || "";
  if (initData) {
    const telegram = verifyTelegramInitData(initData);
    if (telegram?.id) {
      return {
        id: telegram.id,
        username: telegram.user.username ? String(telegram.user.username).replace(/^@/, "") : null,
        firstName: telegram.user.first_name ? String(telegram.user.first_name) : null,
        photoUrl: telegram.user.photo_url ? String(telegram.user.photo_url) : null,
      };
    }
  }

  const session = await checkCustomerSession(req.cookies.get(CUSTOMER_SESSION_COOKIE)?.value);
  if (session?.telegramId) {
    return {
      id: String(session.telegramId),
      username: session.username || null,
      firstName: session.first_name || null,
      photoUrl: null,
    };
  }

  return null;
}

export async function getAuthenticatedTelegramId(req: NextRequest): Promise<string | null> {
  const user = await getAuthenticatedTelegramUser(req);
  return user?.id || null;
}
