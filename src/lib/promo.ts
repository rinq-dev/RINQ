import { prisma } from "./prisma";

// Khởi tạo bảng Giveaway & Mã giảm giá nếu chưa có
export async function initPromoTables() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS Coupon (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        discount INTEGER NOT NULL,
        isPercent INTEGER DEFAULT 0,
        maxUsage INTEGER DEFAULT 100,
        usedCount INTEGER DEFAULT 0,
        isActive INTEGER DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS Giveaway (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        reward TEXT NOT NULL,
        description TEXT,
        winnerCount INTEGER DEFAULT 1,
        status TEXT DEFAULT 'ACTIVE',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        endedAt DATETIME
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS GiveawayParticipant (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        giveawayId INTEGER NOT NULL,
        telegramId TEXT NOT NULL,
        username TEXT,
        firstName TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(giveawayId, telegramId)
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS GiveawayWinner (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        giveawayId INTEGER NOT NULL,
        telegramId TEXT NOT NULL,
        username TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (error) {
    console.error("Lỗi khởi tạo promo tables:", error);
  }
}

function cleanRow<T = any>(row: any): T {
  if (!row) return row;
  const cleaned: any = {};
  for (const [k, v] of Object.entries(row)) {
    cleaned[k] = typeof v === "bigint" ? Number(v) : v;
  }
  return cleaned as T;
}

// ---------------- COUPON SERVICES ----------------
export async function getAllCoupons() {
  await initPromoTables();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM Coupon ORDER BY createdAt DESC`
  );
  return rows.map(cleanRow);
}

export async function createCoupon({
  code,
  discount,
  isPercent,
  maxUsage,
}: {
  code: string;
  discount: number;
  isPercent: boolean;
  maxUsage: number;
}) {
  await initPromoTables();
  const cleanCode = code.trim().toUpperCase();
  await prisma.$executeRawUnsafe(
    `INSERT INTO Coupon (code, discount, isPercent, maxUsage, usedCount, isActive) 
     VALUES (?, ?, ?, ?, 0, 1)`,
    cleanCode,
    discount,
    isPercent ? 1 : 0,
    maxUsage
  );
  return { success: true, code: cleanCode };
}

export async function toggleCoupon(id: number, targetActive?: boolean) {
  await initPromoTables();
  if (targetActive !== undefined) {
    await prisma.$executeRawUnsafe(
      `UPDATE Coupon SET isActive = ? WHERE id = ?`,
      targetActive ? 1 : 0,
      id
    );
  } else {
    await prisma.$executeRawUnsafe(
      `UPDATE Coupon SET isActive = CASE WHEN isActive = 1 THEN 0 ELSE 1 END WHERE id = ?`,
      id
    );
  }
  return { success: true };
}

export async function deleteCoupon(id: number) {
  await initPromoTables();
  await prisma.$executeRawUnsafe(`DELETE FROM Coupon WHERE id = ?`, id);
  return { success: true };
}

export async function updateCoupon({
  id,
  code,
  discount,
  isPercent,
  maxUsage,
  usedCount,
  isActive,
}: {
  id: number;
  code?: string;
  discount?: number;
  isPercent?: boolean;
  maxUsage?: number;
  usedCount?: number;
  isActive?: boolean;
}) {
  await initPromoTables();
  const existing = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM Coupon WHERE id = ?`,
    id
  );
  if (existing.length === 0) return { error: "Không tìm thấy mã giảm giá" };
  const current = cleanRow(existing[0]);

  const newCode = code !== undefined ? code.trim().toUpperCase() : current.code;
  const newDiscount = discount !== undefined ? Number(discount) : current.discount;
  const newIsPercent = isPercent !== undefined ? (isPercent ? 1 : 0) : current.isPercent;
  const newMaxUsage = maxUsage !== undefined ? Number(maxUsage) : current.maxUsage;
  const newUsedCount = usedCount !== undefined ? Number(usedCount) : current.usedCount;
  const newIsActive = isActive !== undefined ? (isActive ? 1 : 0) : current.isActive;

  await prisma.$executeRawUnsafe(
    `UPDATE Coupon SET code = ?, discount = ?, isPercent = ?, maxUsage = ?, usedCount = ?, isActive = ? WHERE id = ?`,
    newCode,
    newDiscount,
    newIsPercent,
    newMaxUsage,
    newUsedCount,
    newIsActive,
    id
  );

  return { success: true };
}

export async function validateCoupon(code: string, originalPrice: number) {
  await initPromoTables();
  const cleanCode = code.trim().toUpperCase();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM Coupon WHERE UPPER(code) = ? AND isActive = 1`,
    cleanCode
  );

  if (rows.length === 0) {
    return { valid: false, error: "Mã giảm giá không tồn tại hoặc đã bị tắt" };
  }

  const cp = cleanRow(rows[0]);
  const usedCount = Number(cp.usedCount || 0);
  const maxUsage = Number(cp.maxUsage || 100);
  const discount = Number(cp.discount || 0);
  const isPercent = Number(cp.isPercent || 0);

  if (usedCount >= maxUsage) {
    return { valid: false, error: `Mã giảm giá này đã hết lượt sử dụng (${usedCount}/${maxUsage})` };
  }

  let discountAmount = 0;
  if (isPercent === 1) {
    discountAmount = Math.round((Number(originalPrice) * discount) / 100);
  } else {
    discountAmount = discount;
  }

  const finalPrice = Math.max(1000, Number(originalPrice) - discountAmount);
  return {
    valid: true,
    code: cp.code,
    discountAmount,
    finalPrice,
  };
}

export async function incrementCouponUsage(code: string) {
  await initPromoTables();
  await prisma.$executeRawUnsafe(
    `UPDATE Coupon SET usedCount = usedCount + 1 WHERE UPPER(code) = ?`,
    code.trim().toUpperCase()
  );
}

// ---------------- GIVEAWAY SERVICES ----------------
export async function getActiveGiveaways() {
  await initPromoTables();
  const gas = await prisma.$queryRawUnsafe<any[]>(
    `SELECT g.*, COUNT(p.id) as participantCount 
     FROM Giveaway g 
     LEFT JOIN GiveawayParticipant p ON g.id = p.giveawayId 
     WHERE g.status = 'ACTIVE' 
     GROUP BY g.id ORDER BY g.createdAt DESC`
  );
  return gas.map(cleanRow);
}

export async function getAllGiveaways() {
  await initPromoTables();
  const gas = await prisma.$queryRawUnsafe<any[]>(
    `SELECT g.*, COUNT(p.id) as participantCount 
     FROM Giveaway g 
     LEFT JOIN GiveawayParticipant p ON g.id = p.giveawayId 
     GROUP BY g.id ORDER BY g.createdAt DESC`
  );
  return gas.map(cleanRow);
}

export async function createGiveaway({
  title,
  reward,
  description,
  winnerCount,
}: {
  title: string;
  reward: string;
  description?: string;
  winnerCount: number;
}) {
  await initPromoTables();
  await prisma.$executeRawUnsafe(
    `INSERT INTO Giveaway (title, reward, description, winnerCount, status) 
     VALUES (?, ?, ?, ?, 'ACTIVE')`,
    title.trim(),
    reward.trim(),
    description?.trim() || null,
    winnerCount || 1
  );
  return { success: true };
}

export async function joinGiveaway(
  giveawayId: number,
  telegramId: string,
  username?: string,
  firstName?: string
) {
  await initPromoTables();
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO GiveawayParticipant (giveawayId, telegramId, username, firstName) 
       VALUES (?, ?, ?, ?)`,
      giveawayId,
      telegramId,
      username || null,
      firstName || null
    );
    return { success: true, message: "Tham gia thành công" };
  } catch (err: any) {
    if (String(err).includes("UNIQUE")) {
      return { success: false, alreadyJoined: true, message: "Bạn đã tham gia sự kiện này rồi!" };
    }
    return { success: false, message: "Lỗi tham gia sự kiện" };
  }
}

export async function drawGiveawayWinners(giveawayId: number) {
  await initPromoTables();
  const gas = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM Giveaway WHERE id = ?`,
    giveawayId
  );
  if (gas.length === 0) return { error: "Không tìm thấy Giveaway" };
  const ga = cleanRow(gas[0]);

  const participants = (
    await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM GiveawayParticipant WHERE giveawayId = ?`,
      giveawayId
    )
  ).map(cleanRow);

  if (participants.length === 0) {
    return { error: "Chưa có ai tham gia sự kiện này để quay thưởng" };
  }

  // Xáo trộn ngẫu nhiên
  const shuffled = participants.sort(() => 0.5 - Math.random());
  const winners = shuffled.slice(0, Math.min(ga.winnerCount, participants.length));

  for (const w of winners) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO GiveawayWinner (giveawayId, telegramId, username) VALUES (?, ?, ?)`,
      giveawayId,
      w.telegramId,
      w.username
    );
  }

  // Đánh dấu kết thúc sự kiện
  await prisma.$executeRawUnsafe(
    `UPDATE Giveaway SET status = 'ENDED', endedAt = CURRENT_TIMESTAMP WHERE id = ?`,
    giveawayId
  );

  return { success: true, winners, ga };
}

export async function deleteGiveaway(giveawayId: number) {
  await initPromoTables();
  await prisma.$executeRawUnsafe(`DELETE FROM GiveawayParticipant WHERE giveawayId = ?`, giveawayId);
  await prisma.$executeRawUnsafe(`DELETE FROM GiveawayWinner WHERE giveawayId = ?`, giveawayId);
  await prisma.$executeRawUnsafe(`DELETE FROM Giveaway WHERE id = ?`, giveawayId);
  return { success: true };
}
