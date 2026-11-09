import { prisma } from "./prisma";

export async function recordBotHeartbeat() {
  const now = BigInt(Date.now());
  try {
    await prisma.botHeartbeat.upsert({
      where: { id: 1 },
      update: { lastPing: now },
      create: { id: 1, lastPing: now },
    });
  } catch (err) {
    console.warn("Lỗi ghi bot heartbeat:", err);
  }
}

export async function stopBotHeartbeat() {
  try {
    await prisma.botHeartbeat.upsert({
      where: { id: 1 },
      update: { lastPing: BigInt(0) },
      create: { id: 1, lastPing: BigInt(0) },
    });
  } catch (err) {
    console.warn("Lỗi dừng bot heartbeat:", err);
  }
}

let botOnlineCache: { status: boolean; expiresAt: number } | null = null;

export async function isBotOnline(): Promise<boolean> {
  const now = Date.now();
  if (botOnlineCache && botOnlineCache.expiresAt > now) {
    return botOnlineCache.status;
  }
  try {
    const hb = await prisma.botHeartbeat.findUnique({
      where: { id: 1 },
    });
    if (!hb) {
      botOnlineCache = { status: false, expiresAt: now + 10000 };
      return false;
    }
    const lastPing = Number(hb.lastPing);
    const online = now - lastPing < 90000;
    botOnlineCache = { status: online, expiresAt: now + 30000 };
    return online;
  } catch {
    return false;
  }
}
