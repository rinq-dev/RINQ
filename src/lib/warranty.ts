import { prisma } from "./prisma";
import { decryptStock } from "./crypto";

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID || "8907169582";

// Helper: Phân tích thời gian bảo hành hợp lệ từ chuỗi chính sách bảo hành
export function parseWarrantyDurationMs(warrantyText?: string | null): number {
  if (!warrantyText) return 24 * 60 * 60 * 1000; // Mặc định 24 giờ

  const text = warrantyText.toLowerCase();

  const monthMatch = text.match(/(\d+)\s*(?:tháng|m|month)/);
  if (monthMatch) {
    return parseInt(monthMatch[1], 10) * 30 * 24 * 60 * 60 * 1000;
  }

  const dayMatch = text.match(/(\d+)\s*(?:ngày|d|day)/);
  if (dayMatch) {
    return parseInt(dayMatch[1], 10) * 24 * 60 * 60 * 1000;
  }

  const hourMatch = text.match(/(\d+)\s*(?:giờ|h|hour)/);
  if (hourMatch) {
    return parseInt(hourMatch[1], 10) * 60 * 60 * 1000;
  }

  return 24 * 60 * 60 * 1000; // Mặc định 24h
}

// Kiểm tra điều kiện bảo hành của đơn hàng
export function checkOrderWarrantyStatus(order: any) {
  if (order.status !== "PAID") {
    return { eligible: false, reason: "Đơn hàng chưa thanh toán thành công" };
  }

  if (order.warrantyCount >= 1) {
    return {
      eligible: false,
      reason: "Đơn hàng đã được đổi bảo hành tự động 1 lần. Vui lòng liên hệ Admin @rinq_hotro để được hỗ trợ thủ công!",
    };
  }

  const baseDate = order.paidAt ? new Date(order.paidAt) : new Date(order.createdAt);
  const durationMs = parseWarrantyDurationMs(order.product?.warranty);
  const expiryDate = new Date(baseDate.getTime() + durationMs);
  const now = new Date();

  if (now > expiryDate) {
    const expiredHours = Math.round((now.getTime() - expiryDate.getTime()) / (60 * 60 * 1000));
    return {
      eligible: false,
      reason: `Đơn hàng đã hết hạn bảo hành tự động (quá hạn ${expiredHours} giờ). Vui lòng liên hệ Admin @rinq_hotro để được hỗ trợ!`,
    };
  }

  const remainingHours = Math.max(0, Math.round((expiryDate.getTime() - now.getTime()) / (60 * 60 * 1000)));

  return { eligible: true, remainingHours, expiryDate };
}

// Xử lý đổi bảo hành 1 chạm tự động
export async function processAutoWarranty(orderId: string, telegramId: string) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        product: true,
        stocks: true,
      },
    });

    if (!order) {
      return { success: false, error: "Không tìm thấy đơn hàng" };
    }

    if (String(order.telegramId) !== String(telegramId)) {
      return { success: false, error: "Bạn không có quyền thực hiện trên đơn hàng này" };
    }

    const check = checkOrderWarrantyStatus(order);
    if (!check.eligible) {
      return { success: false, error: check.reason };
    }

    // Tìm stock khả dụng trong kho cùng sản phẩm
    const availableStock = await prisma.stockItem.findFirst({
      where: {
        productId: order.productId,
        isSold: false,
        isFaulty: false,
      },
      orderBy: { id: "asc" },
    });

    // TRƯỜNG HỢP 1: Kho tạm hết hàng để đổi tự động -> Gửi thông báo khẩn tới Admin
    if (!availableStock) {
      if (BOT_TOKEN && ADMIN_TELEGRAM_ID) {
        const alertAdmin =
          `⚠️ <b>[BẢO HÀNH CẦN XỬ LÝ - KHO TẠM HẾT]</b>\n\n` +
          `• Mã đơn: <code>#${order.id}</code>\n` +
          `• Khách hàng: <b>${order.username ? `@${order.username}` : order.telegramId}</b>\n` +
          `• Sản phẩm: <b>${order.product.name}</b>\n` +
          `• Lý do: Khách bấm đổi bảo hành 1 chạm nhưng kho thủ công đang hết hàng.\n\n` +
          `👉 <i>Vui lòng nạp kho hoặc liên hệ khách hàng ngay!</i>`;

        fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: ADMIN_TELEGRAM_ID,
            text: alertAdmin,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [{ text: "💬 Nhắn khách hàng", url: `tg://user?id=${order.telegramId}` }],
              ],
            },
          }),
        }).catch(() => {});
      }

      return {
        success: false,
        outOfStock: true,
        error:
          "Kho hiện tại tạm hết tài nguyên mới để tự động cấp. Hệ thống đã chuyển yêu cầu của bạn tới Admin @rinq_hotro để xử lý ưu tiên!",
      };
    }

    // TRƯỜNG HỢP 2: Kho còn hàng -> Thực hiện đổi key trong Transaction
    const newStock = await prisma.$transaction(async (tx) => {
      // Đánh dấu các stock cũ của đơn là faulty
      await tx.stockItem.updateMany({
        where: { orderId: order.id },
        data: { isFaulty: true },
      });

      // Cấp stock mới
      const updatedStock = await tx.stockItem.update({
        where: { id: availableStock.id },
        data: {
          isSold: true,
          orderId: order.id,
        },
      });

      // Cập nhật đơn hàng
      await tx.order.update({
        where: { id: order.id },
        data: {
          warrantyCount: { increment: 1 },
          warrantyReplacedAt: new Date(),
          warrantyNote: "Đổi bảo hành tự động 1 chạm",
        },
      });

      return updatedStock;
    });

    const decryptedKey = decryptStock(newStock.data);

    // Gửi tin nhắn key mới cho khách qua Telegram Bot
    if (BOT_TOKEN) {
      const customerMsg =
        `🛡️ <b>BẢO HÀNH THÀNH CÔNG · ĐÃ ĐỔI TÀI NGUYÊN MỚI</b>\n\n` +
        `Kính gửi Quý khách, hệ thống đã kiểm tra và tự động đổi tài nguyên mới cho đơn hàng <b>#${order.id}</b>:\n\n` +
        `📦 <b>Sản phẩm:</b> ${order.product.name}\n` +
        `🔑 <b>Tài nguyên mới:</b>\n` +
        `<code>${decryptedKey}</code>\n\n` +
        `<blockquote>💡 <i>Chạm vào mã để sao chép. Nếu cần hỗ trợ thêm, Quý khách vui lòng liên hệ Admin @rinq_hotro.</i></blockquote>`;

      fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: order.telegramId,
          text: customerMsg,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "💬 Hỗ trợ Admin (@rinq_hotro)", url: "https://t.me/rinq_hotro" }],
            ],
          },
        }),
      }).catch(() => {});
    }

    // Thông báo cho Admin
    if (BOT_TOKEN && ADMIN_TELEGRAM_ID) {
      const adminMsg =
        `🛡️ <b>[BẢO HÀNH TỰ ĐỘNG THÀNH CÔNG]</b>\n\n` +
        `• Mã đơn: <code>#${order.id}</code>\n` +
        `• Khách: <b>${order.username ? `@${order.username}` : order.telegramId}</b>\n` +
        `• Sản phẩm: <b>${order.product.name}</b>\n` +
        `• Key mới đã cấp: <code>${decryptedKey}</code>`;

      fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: ADMIN_TELEGRAM_ID,
          text: adminMsg,
          parse_mode: "HTML",
        }),
      }).catch(() => {});
    }

    return {
      success: true,
      key: decryptedKey,
    };
  } catch (err: any) {
    console.error("Lỗi processAutoWarranty:", err);
    return { success: false, error: err.message || "Lỗi máy chủ" };
  }
}
