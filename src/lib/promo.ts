import { prisma } from "./prisma";

// ---------------- COUPON SERVICES ----------------
export async function getAllCoupons() {
  return await prisma.coupon.findMany({
    orderBy: { createdAt: "desc" },
  });
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
  const cleanCode = code.trim().toUpperCase();
  await prisma.coupon.create({
    data: {
      code: cleanCode,
      discount,
      isPercent,
      maxUsage,
      usedCount: 0,
      isActive: true,
    },
  });
  return { success: true, code: cleanCode };
}

export async function toggleCoupon(id: number, targetActive?: boolean) {
  const existing = await prisma.coupon.findUnique({ where: { id } });
  if (!existing) return { error: "Không tìm thấy coupon" };

  await prisma.coupon.update({
    where: { id },
    data: {
      isActive: targetActive !== undefined ? targetActive : !existing.isActive,
    },
  });
  return { success: true };
}

export async function deleteCoupon(id: number) {
  await prisma.coupon.delete({ where: { id } });
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
  const existing = await prisma.coupon.findUnique({ where: { id } });
  if (!existing) return { error: "Không tìm thấy mã giảm giá" };

  await prisma.coupon.update({
    where: { id },
    data: {
      code: code !== undefined ? code.trim().toUpperCase() : existing.code,
      discount: discount !== undefined ? Number(discount) : existing.discount,
      isPercent: isPercent !== undefined ? isPercent : existing.isPercent,
      maxUsage: maxUsage !== undefined ? Number(maxUsage) : existing.maxUsage,
      usedCount: usedCount !== undefined ? Number(usedCount) : existing.usedCount,
      isActive: isActive !== undefined ? isActive : existing.isActive,
    },
  });

  return { success: true };
}

export async function validateCoupon(code: string, originalPrice: number) {
  const cleanCode = code.trim().toUpperCase();
  const cp = await prisma.coupon.findUnique({
    where: { code: cleanCode },
  });

  if (!cp || !cp.isActive) {
    return { valid: false, error: "Mã giảm giá không tồn tại hoặc đã bị tắt" };
  }

  if (cp.usedCount >= cp.maxUsage) {
    return { valid: false, error: `Mã giảm giá này đã hết lượt sử dụng (${cp.usedCount}/${cp.maxUsage})` };
  }

  let discountAmount = 0;
  if (cp.isPercent) {
    discountAmount = Math.round((Number(originalPrice) * cp.discount) / 100);
  } else {
    discountAmount = cp.discount;
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
  await prisma.coupon.update({
    where: { code: code.trim().toUpperCase() },
    data: {
      usedCount: { increment: 1 },
    },
  }).catch(() => {});
}

// ---------------- GIVEAWAY SERVICES ----------------
export async function getActiveGiveaways() {
  const list = await prisma.giveaway.findMany({
    where: { status: "ACTIVE" },
    include: {
      _count: {
        select: { participants: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return list.map((g) => ({
    ...g,
    participantCount: g._count.participants,
  }));
}

export async function getAllGiveaways() {
  const list = await prisma.giveaway.findMany({
    include: {
      _count: {
        select: { participants: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return list.map((g) => ({
    ...g,
    participantCount: g._count.participants,
  }));
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
  await prisma.giveaway.create({
    data: {
      title: title.trim(),
      reward: reward.trim(),
      description: description?.trim() || null,
      winnerCount: winnerCount || 1,
      status: "ACTIVE",
    },
  });
  return { success: true };
}

export async function joinGiveaway(
  giveawayId: number,
  telegramId: string,
  username?: string,
  firstName?: string
) {
  try {
    await prisma.giveawayParticipant.create({
      data: {
        giveawayId,
        telegramId: String(telegramId),
        username: username || null,
        firstName: firstName || null,
      },
    });
    return { success: true, message: "Tham gia thành công" };
  } catch (err: any) {
    if (String(err).includes("Unique") || String(err).includes("UNIQUE")) {
      return { success: false, alreadyJoined: true, message: "Bạn đã tham gia sự kiện này rồi!" };
    }
    return { success: false, message: "Lỗi tham gia sự kiện" };
  }
}

export async function drawGiveawayWinners(giveawayId: number) {
  const ga = await prisma.giveaway.findUnique({
    where: { id: giveawayId },
    include: { participants: true },
  });

  if (!ga) return { error: "Không tìm thấy Giveaway" };
  if (!ga.participants || ga.participants.length === 0) {
    return { error: "Chưa có ai tham gia sự kiện này để quay thưởng" };
  }

  // Xáo trộn ngẫu nhiên
  const shuffled = [...ga.participants].sort(() => 0.5 - Math.random());
  const winners = shuffled.slice(0, Math.min(ga.winnerCount, ga.participants.length));

  for (const w of winners) {
    await prisma.giveawayWinner.create({
      data: {
        giveawayId,
        telegramId: w.telegramId,
        username: w.username || null,
      },
    });
  }

  // Đánh dấu kết thúc sự kiện
  await prisma.giveaway.update({
    where: { id: giveawayId },
    data: {
      status: "ENDED",
      endedAt: new Date(),
    },
  });

  return { success: true, winners, ga };
}

export async function deleteGiveaway(giveawayId: number) {
  await prisma.giveaway.delete({
    where: { id: giveawayId },
  });
  return { success: true };
}
