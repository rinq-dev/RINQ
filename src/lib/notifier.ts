import { prisma } from "./prisma";

// Lưu user khi bấm /start
export async function addSubscriber(id: string, username?: string, firstName?: string) {
  try {
    await prisma.telegramUser.upsert({
      where: { id },
      update: {
        username: username || null,
        firstName: firstName || null,
      },
      create: {
        id,
        username: username || null,
        firstName: firstName || null,
      },
    });
  } catch (error) {
    console.error("Lỗi thêm subscriber:", error);
  }
}

// Lấy danh sách ID người nhận (gồm cả user /start, khách web auth và khách từng đặt đơn)
export async function getAllSubscriberIds(): Promise<string[]> {
  const set = new Set<string>();

  try {
    const rows = await prisma.telegramUser.findMany({
      select: { id: true },
    });
    rows.forEach((r) => {
      if (r.id) set.add(String(r.id).trim());
    });
  } catch (err) {
    console.warn("Lỗi lấy TelegramUser:", err);
  }

  try {
    const orderUsers = await prisma.order.findMany({
      select: { telegramId: true },
      distinct: ["telegramId"],
    });
    orderUsers.forEach((o) => {
      if (o.telegramId) set.add(String(o.telegramId).trim());
    });
  } catch (err) {
    console.warn("Lỗi lấy orderUsers:", err);
  }

  try {
    const sessionUsers = await prisma.webAuthSession.findMany({
      where: { isVerified: true, telegramId: { not: null } },
      select: { telegramId: true },
    });
    sessionUsers.forEach((s) => {
      if (s.telegramId) set.add(String(s.telegramId).trim());
    });
  } catch (err) {
    console.warn("Lỗi lấy sessionUsers:", err);
  }

  // Luôn bao gồm Admin Telegram ID để nhận thông báo và tính vào lượng người dùng
  const adminId = process.env.ADMIN_TELEGRAM_ID;
  if (adminId && adminId.trim()) {
    set.add(adminId.trim());
  }

  // Thêm kênh thông báo (nếu có cấu hình trong .env)
  const channelId = process.env.TELEGRAM_CHANNEL_ID;
  if (channelId && channelId.trim()) {
    set.add(channelId.trim());
  }

  // Đảm bảo loại bỏ giá trị rỗng
  set.delete("");
  set.delete("undefined");
  set.delete("null");

  return Array.from(set);
}

// Đếm số lượng subscribers
export async function countSubscribers(): Promise<number> {
  const ids = await getAllSubscriberIds();
  return ids.length;
}

// Bắn thông báo giới thiệu sản phẩm / hàng mới tới khách hàng
export async function broadcastStockAlert({
  productId,
  productName,
  price,
  addedCount,
  totalStock,
}: {
  productId: number;
  productName?: string;
  price?: number;
  addedCount?: number;
  totalStock?: number;
}) {
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) {
    return { success: false, error: "BOT_TOKEN chưa được cấu hình" };
  }

  const recipients = await getAllSubscriberIds();
  if (recipients.length === 0) {
    return { success: true, sentCount: 0, total: 0, message: "Chưa có người dùng nào để gửi thông báo" };
  }

  // Tải đầy đủ thông tin sản phẩm từ database (ảnh, mô tả, chính sách bảo hành, ghi chú)
  const product = await prisma.product
    .findUnique({
      where: { id: productId },
    })
    .catch(() => null);

  const name = product?.name || productName || "Sản phẩm";
  const cost = product?.price ?? price ?? 0;
  const imageUrl = product?.imageUrl?.trim() || "";
  const desc = product?.description?.trim() || "";
  const warranty = product?.warranty?.trim() || "";
  const priceNote = product?.priceNote?.trim() || "";

  // Tạo nội dung thông báo đẹp mắt dạng bài giới thiệu sản phẩm
  const buildText = (maxDescLen?: number) => {
    const lines: string[] = [];
    lines.push(`✦ <b>${name.toUpperCase()}</b> ✦\n`);
    lines.push(
      `💰 <b>${cost.toLocaleString("vi-VN")} đ</b> / sản phẩm • 🟢 <b>Sẵn hàng (Giao tự động 24/7)</b>\n`
    );

    if (desc) {
      if (maxDescLen && desc.length > maxDescLen) {
        lines.push(`${desc.slice(0, maxDescLen)}...\n`);
      } else {
        lines.push(`${desc}\n`);
      }
    }

    if (warranty) {
      const hasShield = warranty.includes("🛡️") || warranty.includes("BẢO HÀNH");
      lines.push(`<blockquote>${hasShield ? "" : "🛡️ <b>CHÍNH SÁCH BẢO HÀNH:</b>\n"}${warranty}</blockquote>\n`);
    }

    if (priceNote) {
      lines.push(`<blockquote>📝 <b>GHI CHÚ:</b>\n${priceNote}</blockquote>\n`);
    }

    lines.push(`👇 <i>Kính mời Quý khách bấm nút bên dưới để xem gói và đặt mua:</i>`);
    return lines.join("\n");
  };

  const captionText = buildText(350); // Caption sendPhoto tối đa 1024 ký tự
  const fullMessageText = buildText(); // Cho tin nhắn văn bản sendMessage

  const inline_keyboard = [
    [
      {
        text: `✨ Xem ${name.slice(0, 32)} · ${cost.toLocaleString("vi-VN")}đ`,
        callback_data: `prod:${productId}`,
      },
    ],
  ];

  let sentCount = 0;
  for (const chatId of recipients) {
    try {
      let sent = false;
      if (imageUrl) {
        try {
          const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              photo: imageUrl,
              caption: captionText.slice(0, 1024),
              parse_mode: "HTML",
              reply_markup: { inline_keyboard },
            }),
          });
          if (res.ok) sent = true;
        } catch {}
      }

      if (!sent) {
        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: fullMessageText.slice(0, 4096),
            parse_mode: "HTML",
            reply_markup: { inline_keyboard },
          }),
        });
        if (res.ok) sent = true;
      }

      if (sent) sentCount++;
    } catch (err) {
      console.error(`Lỗi gửi thông báo sản phẩm đến ${chatId}:`, err);
    }
  }

  return { success: true, sentCount, total: recipients.length };
}

// Bắn chiến dịch marketing tùy chỉnh từ Admin.
export async function broadcastCustomMessage({
  title,
  text,
  imageUrl,
  buttonText,
  buttonUrl,
}: {
  title?: string;
  text: string;
  imageUrl?: string;
  buttonText?: string;
  buttonUrl?: string;
}) {
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) {
    return { success: false, error: "BOT_TOKEN chưa được cấu hình" };
  }

  const recipients = await getAllSubscriberIds();
  if (recipients.length === 0) {
    return { success: true, sentCount: 0, total: 0, message: "Chưa có người dùng nào" };
  }

  const fullMessage = `${title?.trim() ? `<b>${title.trim()}</b>` : "📢 <b>RINQ SHOP</b>"}\n\n${text}`;
  const replyMarkup = buttonText?.trim() && buttonUrl?.trim()
    ? { inline_keyboard: [[{ text: buttonText.trim().slice(0, 64), url: buttonUrl.trim() }]] }
    : undefined;

  let sentCount = 0;
  for (const chatId of recipients) {
    try {
      const method = imageUrl?.trim() ? "sendPhoto" : "sendMessage";
      const payload = imageUrl?.trim()
        ? { chat_id: chatId, photo: imageUrl.trim(), caption: fullMessage, parse_mode: "HTML", reply_markup: replyMarkup }
        : { chat_id: chatId, text: fullMessage, parse_mode: "HTML", reply_markup: replyMarkup };
      const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) sentCount++;
    } catch (err) {
      console.error(`Lỗi gửi thông báo tùy chỉnh đến ${chatId}:`, err);
    }
  }

  return { success: true, sentCount, total: recipients.length };
}

// Bắn thông báo cập nhật giá / giảm giá
export async function broadcastPriceUpdate({
  productId,
  productName,
  oldPrice,
  newPrice,
  priceReason,
}: {
  productId: number;
  productName: string;
  oldPrice: number;
  newPrice: number;
  priceReason?: string;
}) {
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) {
    return { success: false, error: "BOT_TOKEN chưa được cấu hình" };
  }

  const recipients = await getAllSubscriberIds();
  if (recipients.length === 0) {
    return { success: true, sentCount: 0, total: 0, message: "Chưa có người dùng nào" };
  }

  const isDiscount = newPrice < oldPrice;
  const header = isDiscount ? "✦ THÔNG BÁO ƯU ĐÃI ĐẶC BIỆT ✦" : "✦ THÔNG BÁO ĐIỀU CHỈNH ĐƠN GIÁ ✦";

  let noteBlock = "";
  if (priceReason && priceReason.trim()) {
    noteBlock = `<blockquote>📝 <b>Lý do / Ghi chú từ hệ thống:</b>\n${priceReason.trim()}</blockquote>\n\n`;
  }

  const message =
    `<b>${header}</b>\n` +
    `\n` +
    `Kính gửi Quý khách, RINQ SHOP xin trân trọng thông báo thông tin cập nhật giá sản phẩm:\n\n` +
    `📦 <b>Sản phẩm:</b> <b>${productName}</b>\n` +
    `💸 <b>Đơn giá trước đây:</b> <s>${oldPrice.toLocaleString("vi-VN")} đ</s>\n` +
    `💎 <b>Đơn giá áp dụng:</b> <b>${newPrice.toLocaleString("vi-VN")} đ</b>\n\n` +
    noteBlock +
    `<i>Kính mời Quý khách chọn nút bên dưới để tham khảo và trải nghiệm dịch vụ:</i>`;

  const inline_keyboard = [
    [
      {
        text: `🛒 Mua ngay · ${newPrice.toLocaleString("vi-VN")}đ`,
        callback_data: `prod:${productId}`,
      },
    ],
  ];

  let sentCount = 0;
  for (const chatId of recipients) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard },
        }),
      });
      if (res.ok) sentCount++;
    } catch (err) {
      console.error(`Lỗi gửi thông báo giá đến ${chatId}:`, err);
    }
  }

  return { success: true, sentCount, total: recipients.length };
}
