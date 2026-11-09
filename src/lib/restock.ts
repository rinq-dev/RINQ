import { prisma } from "./prisma";

const BOT_TOKEN = process.env.BOT_TOKEN;

// 1. Đăng ký nhận thông báo khi có hàng
export async function subscribeRestock(productId: number, telegramId: string, username?: string) {
  try {
    const existing = await prisma.restockSubscription.findUnique({
      where: {
        productId_telegramId: {
          productId,
          telegramId,
        },
      },
    });

    if (existing) {
      return { success: true, alreadySubscribed: true };
    }

    await prisma.restockSubscription.create({
      data: {
        productId,
        telegramId,
        username: username || null,
      },
    });

    return { success: true, alreadySubscribed: false };
  } catch (err: any) {
    console.error("Lỗi đăng ký restock:", err);
    return { success: false, error: err.message };
  }
}

// 2. Hủy đăng ký nhận thông báo
export async function unsubscribeRestock(productId: number, telegramId: string) {
  try {
    await prisma.restockSubscription.deleteMany({
      where: {
        productId,
        telegramId,
      },
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// 3. Tự động gửi thông báo cho khách khi nạp kho
export async function notifyRestockSubscribers(productId: number, newStockCount: number) {
  if (!BOT_TOKEN) return { count: 0 };

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product || newStockCount <= 0) return { count: 0 };

    const subs = await prisma.restockSubscription.findMany({
      where: { productId },
    });

    if (subs.length === 0) return { count: 0 };

    let notifiedCount = 0;

    const messageText =
      `🔔 <b>SẢN PHẨM BẠN ĐĂNG KÝ ĐÃ CÓ HÀNG TRỞ LẠI!</b>\n\n` +
      `📦 <b>${product.name}</b>\n` +
      `💰 Đơn giá: <b>${product.price.toLocaleString("vi-VN")} đ</b>\n` +
      `🟢 Số lượng vừa nạp: <b>${newStockCount}</b> tài nguyên\n\n` +
      `👉 <i>Kính mời Quý khách bấm vào nút bên dưới để đặt mua ngay trước khi hết hàng:</i>`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: "💳 Mua ngay", callback_data: `buy:${product.id}` },
          { text: "🔍 Xem chi tiết", callback_data: `prod:${product.id}` },
        ],
      ],
    };

    for (const sub of subs) {
      try {
        const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: sub.telegramId,
            text: messageText,
            parse_mode: "HTML",
            reply_markup: inlineKeyboard,
          }),
        });

        if (res.ok) {
          notifiedCount++;
        }
      } catch (e) {
        console.warn(`Lỗi gửi thông báo restock cho ${sub.telegramId}:`, e);
      }
    }

    // Xóa các đăng ký đã thông báo để không gửi lặp
    await prisma.restockSubscription.deleteMany({
      where: { productId },
    });

    return { count: notifiedCount };
  } catch (err: any) {
    console.error("Lỗi notifyRestockSubscribers:", err);
    return { count: 0, error: err.message };
  }
}
