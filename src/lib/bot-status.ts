import { prisma } from "./prisma";

export async function initBotHeartbeatTable() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS BotHeartbeat (
        id INTEGER PRIMARY KEY DEFAULT 1,
        lastPing INTEGER NOT NULL
      )
    `);
  } catch (err) {
    console.error("Lỗi tạo bảng BotHeartbeat:", err);
  }
}

export async function recordBotHeartbeat() {
  await initBotHeartbeatTable();
  const now = Date.now();
  await prisma.$executeRawUnsafe(
    `INSERT INTO BotHeartbeat (id, lastPing) VALUES (1, ?)
     ON CONFLICT(id) DO UPDATE SET lastPing = ?`,
    now,
    now
  );
}

export async function stopBotHeartbeat() {
  await initBotHeartbeatTable();
  await prisma.$executeRawUnsafe(
    `UPDATE BotHeartbeat SET lastPing = 0 WHERE id = 1`
  );
}

export async function isBotOnline(): Promise<boolean> {
  await initBotHeartbeatTable();
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT lastPing FROM BotHeartbeat WHERE id = 1`
    );
    if (!rows || rows.length === 0) return false;
    const lastPing = Number(rows[0].lastPing || 0);
    const now = Date.now();
    // Coi là Online nếu Bot cập nhật trong vòng 15 giây qua
    return now - lastPing < 15000;
  } catch {
    return false;
  }
}
