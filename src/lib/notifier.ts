import { prisma } from "./prisma";

// Khởi tạo bảng lưu subscriber nếu chưa có
export async function initSubscriberTable() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS TelegramUser (
        id TEXT PRIMARY KEY,
        username TEXT,
        firstName TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (error) {
    console.error("Lỗi khởi tạo TelegramUser table:", error);
  }
}

// Lưu user khi bấm /start
export async function addSubscriber(id: string, username?: string, firstName?: string) {
  try {
    await initSubscriberTable();
    await prisma.$executeRawUnsafe(
      `INSERT INTO TelegramUser (id, username, firstName) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET username = excluded.username, firstName = excluded.firstName`,
      id,
      username || null,
      firstName || null
    );
  } catch (error) {
    console.error("Lỗi thêm subscriber:", error);
  }
}

// Lấy danh sách ID người nhận (gồm cả user /start và khách từng đặt đơn)
export async function getAllSubscriberIds(): Promise<string[]> {
  try {
    await initSubscriberTable();
    const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM TelegramUser`
    );

    const orderUsers = await prisma.order.findMany({
      select: { telegramId: true },
      distinct: ["telegramId"],
    });

    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.id) set.add(String(r.id));
    });
    orderUsers.forEach((o) => {
      if (o.telegramId) set.add(String(o.telegramId));
    });

    // Thêm kênh thông báo (nếu có cấu hình trong .env)
    const channelId = process.env.TELEGRAM_CHANNEL_ID;
    if (channelId && channelId.trim()) {
      set.add(channelId.trim());
    }

    return Array.from(set);
  } catch (error) {
    console.error("Lỗi lấy danh sách subscribers:", error);
    return [];
  }
}

// Đếm số lượng subscribers
export async function countSubscribers(): Promise<number> {
  const ids = await getAllSubscriberIds();
  return ids.length;
}

// Bắn thông báo hàng mới về
export async function broadcastStockAlert({
  productId,
  productName,
  price,
  addedCount,
  totalStock,
}: {
  productId: number;
  productName: string;
  price: number;
  addedCount: number;
  totalStock: number;
}) {
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) {
    return { success: false, error: "BOT_TOKEN chưa được cấu hình" };
  }

  const recipients = await getAllSubscriberIds();
  if (recipients.length === 0) {
    return { success: true, sentCount: 0, total: 0, message: "Chưa có người dùng nào để gửi thông báo" };
  }

  const message =
    `✦ <b>RINQ SHOP · THÔNG BÁO TÀI NGUYÊN VỀ KHO</b> ✦\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Kính gửi Quý khách, sản phẩm Quý khách quan tâm vừa được cập nhật thêm số lượng mới vào kho:\n\n` +
    `📦 <b>Sản phẩm:</b> <b>${productName}</b>\n` +
    `⚡ <b>Số lượng bổ sung:</b> <b>+${addedCount} tài nguyên</b>\n` +
    `📊 <b>Tồn kho sẵn có:</b> <b>${totalStock} sản phẩm</b>\n` +
    `💰 <b>Đơn giá ưu đãi:</b> <b>${price.toLocaleString("vi-VN")} đ</b>\n\n` +
    `<i>Kính mời Quý khách bấm nút bên dưới để đặt mua tự động tức thì:</i>`;

  const inline_keyboard = [
    [
      {
        text: `🛒 Mua ngay ${productName}`,
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
      if (res.ok) {
        sentCount++;
      }
    } catch (err) {
      console.error(`Lỗi gửi thông báo đến ${chatId}:`, err);
    }
  }

  return { success: true, sentCount, total: recipients.length };
}

// Bắn thông báo tùy chỉnh bất kỳ từ Admin
export async function broadcastCustomMessage(text: string) {
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) {
    return { success: false, error: "BOT_TOKEN chưa được cấu hình" };
  }

  const recipients = await getAllSubscriberIds();
  if (recipients.length === 0) {
    return { success: true, sentCount: 0, total: 0, message: "Chưa có người dùng nào" };
  }

  const fullMessage = `📢 <b>THÔNG BÁO TỪ RINQ SHOP</b>\n\n${text}`;

  let sentCount = 0;
  for (const chatId of recipients) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: fullMessage,
          parse_mode: "HTML",
        }),
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
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
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
