import { prisma } from "./prisma";

const DEFAULT_COMMISSION_PERCENT = 5; // 5% hoa hồng cho người giới thiệu

// 1. Ghi nhận người giới thiệu khi khách mới vào bot qua link ref_USERID
export async function recordReferral(refCode: string, newUserId: string): Promise<boolean> {
  const referrerId = refCode.replace(/^ref_/, "").trim();

  // Không tự giới thiệu chính mình
  if (!referrerId || referrerId === newUserId) return false;

  try {
    // Kiểm tra người giới thiệu có tồn tại trên bot không
    const referrer = await prisma.telegramUser.findUnique({
      where: { id: referrerId },
    });
    if (!referrer) return false;

    // Kiểm tra xem khách mới đã từng được ai giới thiệu trước đó chưa
    const refKey = `ref_by:${newUserId}`;
    const existingRef = await prisma.appSetting.findUnique({
      where: { key: refKey },
    });
    if (existingRef) return false;

    // Lưu người giới thiệu
    await prisma.appSetting.create({
      data: {
        key: refKey,
        value: referrerId,
      },
    });

    return true;
  } catch (err) {
    console.warn("Lỗi ghi nhận referral:", err);
    return false;
  }
}

// 2. Lấy thông tin người giới thiệu của một khách hàng
export async function getReferrerId(userId: string): Promise<string | null> {
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: `ref_by:${userId}` },
    });
    return row?.value || null;
  } catch {
    return null;
  }
}

// 3. Trả hoa hồng cho người giới thiệu khi đơn hàng thành công
export async function rewardAffiliateCommission(order: {
  id: string;
  telegramId: string;
  totalAmount: number;
  product?: { name?: string };
}): Promise<{ rewarded: boolean; referrerId?: string; commission?: number }> {
  try {
    const referrerId = await getReferrerId(order.telegramId);
    if (!referrerId) return { rewarded: false };

    // Tính hoa hồng (mặc định 5%)
    const commission = Math.round(order.totalAmount * (DEFAULT_COMMISSION_PERCENT / 100));
    if (commission <= 0) return { rewarded: false };

    // Chống trả trùng hoa hồng cho cùng một đơn
    const rewardTxKey = `aff_reward_tx:${order.id}`;
    const alreadyRewarded = await prisma.appSetting.findUnique({
      where: { key: rewardTxKey },
    });
    if (alreadyRewarded) return { rewarded: false };

    // Cộng tiền vào ví người giới thiệu
    await prisma.$transaction([
      prisma.telegramUser.upsert({
        where: { id: referrerId },
        update: { balance: { increment: commission } },
        create: { id: referrerId, balance: commission },
      }),
      prisma.walletTransaction.create({
        data: {
          id: `REF${order.id.slice(-8)}`,
          telegramId: referrerId,
          amount: commission,
          type: "AFFILIATE",
          status: "SUCCESS",
          description: `Hoa hồng ${DEFAULT_COMMISSION_PERCENT}% từ đơn #${order.id}`,
        },
      }),
      prisma.appSetting.create({
        data: {
          key: rewardTxKey,
          value: JSON.stringify({ commission, referrerId, at: new Date().toISOString() }),
        },
      }),
    ]);

    // Gửi thông báo Telegram cho người giới thiệu
    const botToken = process.env.BOT_TOKEN;
    if (botToken) {
      const updatedReferrer = await prisma.telegramUser.findUnique({ where: { id: referrerId } });
      const newBal = updatedReferrer?.balance || commission;

      const notifyText =
        `🎉 <b>HOA HỒNG GIỚI THIỆU THÀNH CÔNG!</b>\n\n` +
        `Bạn vừa nhận được khoản hoa hồng từ đơn hàng của bạn bè:\n\n` +
        `➕ <b>Tiền thưởng:</b> <b>+${commission.toLocaleString("vi-VN")} đ</b> (${DEFAULT_COMMISSION_PERCENT}% đơn hàng)\n` +
        `💳 <b>Số dư ví hiện tại:</b> <b>${newBal.toLocaleString("vi-VN")} đ</b>\n` +
        `🧾 <b>Mã đơn hàng:</b> <code>#${order.id}</code>\n\n` +
        `<blockquote>💡 <i>Số dư này có thể dùng để mua ngay mọi tài nguyên trên shop hoặc tích lũy thêm!</i></blockquote>`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "💳 Xem ví của tôi", callback_data: "menu_wallet" },
            { text: "🤝 Link giới thiệu", callback_data: "menu_affiliate" },
          ],
        ],
      };

      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: referrerId,
          text: notifyText,
          parse_mode: "HTML",
          reply_markup: keyboard,
        }),
      }).catch(() => {});
    }

    return { rewarded: true, referrerId, commission };
  } catch (err) {
    console.error("Lỗi thưởng hoa hồng affiliate:", err);
    return { rewarded: false };
  }
}

// 4. Lấy thống kê giới thiệu của một người dùng
export async function getAffiliateStats(userId: string): Promise<{
  referralCount: number;
  totalCommission: number;
}> {
  try {
    // Đếm số người đã giới thiệu (tìm các key ref_by:* có value = userId)
    const referredUsers = await prisma.appSetting.count({
      where: {
        key: { startsWith: "ref_by:" },
        value: userId,
      },
    });

    // Tính tổng hoa hồng đã nhận
    const affiliateTxs = await prisma.walletTransaction.findMany({
      where: {
        telegramId: userId,
        type: "AFFILIATE",
        status: "SUCCESS",
      },
      select: { amount: true },
    });

    const totalCommission = affiliateTxs.reduce((acc, cur) => acc + (cur.amount || 0), 0);

    return {
      referralCount: referredUsers,
      totalCommission,
    };
  } catch {
    return { referralCount: 0, totalCommission: 0 };
  }
}
