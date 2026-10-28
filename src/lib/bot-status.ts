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

export async function isBotOnline(): Promise<boolean> {
  try {
    const hb = await prisma.botHeartbeat.findUnique({
      where: { id: 1 },
    });
    if (!hb) return false;
    const lastPing = Number(hb.lastPing);
    const now = Date.now();
    return now - lastPing < 15000;
  } catch {
    return false;
  }
}
