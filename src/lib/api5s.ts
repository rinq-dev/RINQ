import { prisma } from "./prisma";
import { fulfillFromSupplier } from "./supplier-fulfillment";
import { encryptStock, decryptStock } from "./crypto";
import { isSupportedOrderId } from "./order-policy";
import { getPaymentSettings } from "./app-settings";

export interface Api5sTransaction {
  transactionID: string;
  amount: string | number;
  description: string;
  transactionDate: string;
  type: "IN" | "OUT";
}

export interface Api5sResponse {
  status: string;
  message?: string;
  transactions?: Api5sTransaction[];
}

let isProcessingLock = false;

// Tải lịch sử giao dịch ACB từ api5s.com
export async function fetchApi5sTransactions(customToken?: string): Promise<Api5sTransaction[]> {
  const token =
    customToken ||
    process.env.API5S_ACB_TOKEN ||
    (await getPaymentSettings().then((s) => s.api5sToken).catch(() => "")) ||
    "3018993f1aa9b3f0c2c4d51bd97d2340";

  if (!token) {
    console.warn("[api5s] Chưa có token API5S_ACB_TOKEN");
    return [];
  }

  const url = `https://api5s.com/historyapiacbv2/${token.trim()}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      console.warn(`[api5s] HTTP ${res.status} khi gọi ${url}`);
      return [];
    }

    const data: Api5sResponse = await res.json().catch(() => ({ status: "error" }));
    if (data.status === "success" && Array.isArray(data.transactions)) {
      return data.transactions;
    }
    return [];
  } catch (err: any) {
    console.error("[api5s] Lỗi kết nối api5s.com:", err?.message || err);
    return [];
  }
}

// Xử lý một giao dịch ngân hàng từ api5s
export async function processApi5sTransaction(tx: Api5sTransaction): Promise<{
  success: boolean;
  reason?: string;
  orderId?: string;
  napId?: string;
}> {
  if (String(tx.type || "").toUpperCase() !== "IN") {
    return { success: false, reason: "NOT_INCOMING" };
  }

  const txKey = `api5s_tx:${tx.transactionID}`;
  const alreadyProcessed = await prisma.appSetting.findUnique({ where: { key: txKey } });
  if (alreadyProcessed) {
    return { success: true, reason: "ALREADY_PROCESSED" };
  }

  const rawContent = tx.description || "";
  const transferAmount = Math.round(Number(tx.amount));

  if (!Number.isSafeInteger(transferAmount) || transferAmount <= 0) {
    return { success: false, reason: "INVALID_AMOUNT" };
  }

  // Khớp mã đơn hàng DH...
  const orderMatch = String(rawContent).match(/DH(?:[A-F0-9]{32}|[A-F0-9]{12}|[A-F0-9]{8})(?![A-F0-9])/i);
  const orderIdCandidate = orderMatch && isSupportedOrderId(orderMatch[0]) ? orderMatch[0].toUpperCase() : null;

  // Khớp mã nạp ví NAP...
  const napMatch = String(rawContent).match(/NAP(?:[A-F0-9]{8}|[A-F0-9]{12}|[0-9]{5,15})(?![A-F0-9])/i);
  const napCandidate = napMatch ? napMatch[0].toUpperCase() : null;

  const botToken = process.env.BOT_TOKEN;
  const adminId = process.env.ADMIN_TELEGRAM_ID;

  // 1. XỬ LÝ NẠP TIỀN VÀO VÍ (NAP...)
  if (napCandidate && !orderIdCandidate) {
    let walletTx = await prisma.walletTransaction.findUnique({
      where: { id: napCandidate },
    });

    let targetTelegramId = walletTx?.telegramId || null;

    if (!walletTx) {
      const possibleTgId = napCandidate.replace(/^NAP/, "");
      const user = await prisma.telegramUser.findUnique({
        where: { id: possibleTgId },
      });
      if (user) {
        targetTelegramId = user.id;
        walletTx = await prisma.walletTransaction.create({
          data: {
            id: napCandidate,
            telegramId: user.id,
            amount: transferAmount,
            type: "DEPOSIT",
            status: "PENDING",
            description: "Nạp tiền ví ACB tự động (api5s)",
          },
        });
      }
    }

    if (!walletTx || !targetTelegramId) {
      await prisma.appSetting.upsert({
        where: { key: txKey },
        update: { value: JSON.stringify({ ...tx, note: "NAP_NOT_FOUND" }) },
        create: { key: txKey, value: JSON.stringify({ ...tx, note: "NAP_NOT_FOUND" }) },
      }).catch(() => {});
      return { success: false, reason: `Không tìm thấy mã nạp ví ${napCandidate}` };
    }

    if (walletTx.status === "SUCCESS") {
      await prisma.appSetting.upsert({
        where: { key: txKey },
        update: { value: JSON.stringify(tx) },
        create: { key: txKey, value: JSON.stringify(tx) },
      }).catch(() => {});
      return { success: true, reason: "NAP_ALREADY_SUCCESS", napId: walletTx.id };
    }

    // Cộng tiền ví và hoàn tất giao dịch
    const updatedUser = await prisma.$transaction(async (prismaTx) => {
      await prismaTx.walletTransaction.update({
        where: { id: walletTx!.id },
        data: {
          status: "SUCCESS",
          amount: transferAmount,
        },
      });

      return await prismaTx.telegramUser.upsert({
        where: { id: targetTelegramId! },
        update: {
          balance: { increment: transferAmount },
        },
        create: {
          id: targetTelegramId!,
          balance: transferAmount,
        },
      });
    });

    // Đánh dấu giao dịch ngân hàng đã xử lý
    await prisma.appSetting.upsert({
      where: { key: txKey },
      update: { value: JSON.stringify(tx) },
      create: { key: txKey, value: JSON.stringify(tx) },
    }).catch(() => {});

    // Xóa tin nhắn QR nạp tiền nếu có
    if (botToken && walletTx.qrMessageId) {
      fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: targetTelegramId,
          message_id: walletTx.qrMessageId,
        }),
      }).catch(() => {});
    }

    // Gửi thông báo cho khách qua Telegram
    if (botToken) {
      const notifyMsg =
        `🎉 <b>NẠP TIỀN VÀO VÍ THÀNH CÔNG!</b>\n\n` +
        `Kính gửi Quý khách, hệ thống đã ghi nhận khoản nạp tiền vào ví qua ACB:\n\n` +
        `➕ <b>Số tiền nạp:</b> <b>+${transferAmount.toLocaleString("vi-VN")} đ</b>\n` +
        `💳 <b>Số dư ví hiện tại:</b> <b>${(updatedUser.balance || 0).toLocaleString("vi-VN")} đ</b>\n` +
        `🧾 <b>Mã giao dịch:</b> <code>${walletTx.id}</code>\n` +
        `🕒 <b>Thời gian:</b> ${new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}\n\n` +
        `<blockquote>💡 <i>Quý khách có thể sử dụng số dư ví này để thanh toán ngay cho mọi sản phẩm trên Bot!</i></blockquote>`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🛒 Mua hàng ngay", callback_data: "menu_products" },
            { text: "💳 Xem ví của tôi", callback_data: "menu_wallet" },
          ],
          [
            { text: "💬 Hỗ trợ Admin (@rinq_hotro)", url: "https://t.me/rinq_hotro" },
          ],
        ],
      };

      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: targetTelegramId,
          text: notifyMsg,
          parse_mode: "HTML",
          reply_markup: keyboard,
        }),
      }).catch(() => {});

      if (adminId && adminId !== targetTelegramId) {
        fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: adminId,
            text:
              `💰 <b>KHÁCH NẠP TIỀN VÍ THÀNH CÔNG [ACB api5s]</b>\n` +
              `• Khách: <code>${targetTelegramId}</code>\n` +
              `• Số tiền: <b>+${transferAmount.toLocaleString("vi-VN")} đ</b>\n` +
              `• Số dư mới: <b>${(updatedUser.balance || 0).toLocaleString("vi-VN")} đ</b>\n` +
              `• Mã GD: <code>${walletTx.id}</code> (ACB: ${tx.transactionID})`,
            parse_mode: "HTML",
          }),
        }).catch(() => {});
      }
    }

    return { success: true, napId: walletTx.id };
  }

  // 2. XỬ LÝ THANH TOÁN ĐƠN HÀNG (DH...)
  if (!orderIdCandidate) {
    // Không có mã đơn hoặc nạp tiền trong nội dung chuyển khoản
    return { success: false, reason: "NO_ORDER_OR_NAP_CODE" };
  }

  const order: any = await prisma.order.findUnique({
    where: { id: orderIdCandidate },
    include: { product: true },
  });

  if (!order) {
    await prisma.appSetting.upsert({
      where: { key: txKey },
      update: { value: JSON.stringify({ ...tx, note: "ORDER_NOT_FOUND" }) },
      create: { key: txKey, value: JSON.stringify({ ...tx, note: "ORDER_NOT_FOUND" }) },
    }).catch(() => {});
    return { success: false, reason: `Không tìm thấy đơn hàng ${orderIdCandidate}` };
  }

  if (order.status === "PAID") {
    await prisma.appSetting.upsert({
      where: { key: txKey },
      update: { value: JSON.stringify(tx) },
      create: { key: txKey, value: JSON.stringify(tx) },
    }).catch(() => {});
    return { success: true, reason: "ORDER_ALREADY_PAID", orderId: order.id };
  }

  if (order.status !== "PENDING") {
    return { success: true, reason: `ORDER_IN_STATUS_${order.status}`, orderId: order.id };
  }

  if (transferAmount < order.totalAmount) {
    console.warn(`[api5s] Đơn ${order.id}: Số tiền chuyển ${transferAmount}đ < ${order.totalAmount}đ`);
    if (botToken && adminId) {
      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: adminId,
          text:
            `⚠️ <b>CẢNH BÁO CHUYỂN THIẾU TIỀN [ACB api5s]</b>\n` +
            `• Mã đơn: <code>${order.id}</code>\n` +
            `• Tiền nhận: <b>${transferAmount.toLocaleString("vi-VN")} đ</b> (Cần: ${order.totalAmount.toLocaleString("vi-VN")} đ)\n` +
            `• Khách: @${order.username || order.telegramId}\n` +
            `• Nội dung CK: <code>${rawContent}</code>`,
          parse_mode: "HTML",
        }),
      }).catch(() => {});
    }
    return { success: false, reason: "INSUFFICIENT_AMOUNT" };
  }

  // Khóa đơn hàng sang PROCESSING để chống xử lý đồng thời
  const claimed = await prisma.order.updateMany({
    where: { id: order.id, status: "PENDING" },
    data: { status: "PROCESSING" },
  });
  if (claimed.count !== 1) {
    return { success: true, reason: "ORDER_CLAIMED_BY_ANOTHER_PROCESS", orderId: order.id };
  }

  const orderQty = order.quantity || 1;
  const qrMessageId = order.qrMessageId || null;
  const supplierVariantId = order.product?.supplierVariantId || null;
  const fulfillmentType = order.product?.fulfillmentType || "HYBRID";

  // Lấy hàng từ kho thủ công
  const availableStocks = await prisma.stockItem.findMany({
    where: {
      productId: order.productId,
      isSold: false,
    },
    orderBy: { id: "asc" },
    take: orderQty,
  });

  const manualToDeliver: typeof availableStocks = [];
  let needFromApiQty = 0;

  if (fulfillmentType === "MANUAL") {
    manualToDeliver.push(...availableStocks);
  } else if (fulfillmentType === "API") {
    needFromApiQty = orderQty;
  } else {
    // Chế độ HYBRID
    if (availableStocks.length >= orderQty) {
      manualToDeliver.push(...availableStocks.slice(0, orderQty));
      needFromApiQty = 0;
    } else {
      manualToDeliver.push(...availableStocks);
      needFromApiQty = orderQty - availableStocks.length;
    }
  }

  const apiDeliveredTexts: string[] = [];
  let supplierErrorMsg: string | null = null;

  if (needFromApiQty > 0) {
    if (supplierVariantId && supplierVariantId.trim()) {
      const fulfillmentRes = await fulfillFromSupplier(
        supplierVariantId.trim(),
        needFromApiQty,
        order.product?.price || 2_000_000
      );
      if (fulfillmentRes.success && fulfillmentRes.items.length > 0) {
        apiDeliveredTexts.push(...fulfillmentRes.items);
      } else {
        supplierErrorMsg = fulfillmentRes.error || "Lỗi tạo đơn qua API NCC";
      }
    }
  }

  // Trường hợp không đủ kho
  if (manualToDeliver.length + apiDeliveredTexts.length < orderQty) {
    console.error(`[api5s] Đơn ${order.id}: Không đủ hàng tự động (${supplierErrorMsg})`);

    // Báo admin
    if (botToken && adminId) {
      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: adminId,
          text:
            `⚠️ <b>CẢNH BÁO ĐƠN HÀNG CẦN XỬ LÝ GẤP [ACB api5s]</b>\n\n` +
            `🧾 <b>Mã đơn:</b> <code>${order.id}</code>\n` +
            `📦 <b>Sản phẩm:</b> <b>${order.product.name}</b> (SL: ${orderQty})\n` +
            `💰 <b>Tiền đã nhận:</b> <b>${order.totalAmount.toLocaleString("vi-VN")} đ</b>\n` +
            `👤 <b>Khách hàng:</b> @${order.username || order.telegramId}\n` +
            `⚠️ <b>Lý do:</b> Kho thiếu hoặc NCC báo lỗi: <code>${supplierErrorMsg || "Hết hàng"}</code>\n\n` +
            `👉 <i>Vui lòng nạp tiền vào ví NCC hoặc gửi hàng thủ công cho khách!</i>`,
          parse_mode: "HTML",
        }),
      }).catch(() => {});
    }

    // Xóa mã QR cũ nếu có
    if (botToken && order.telegramId && qrMessageId) {
      fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: order.telegramId,
          message_id: qrMessageId,
        }),
      }).catch(() => {});
    }

    // Báo khách hàng
    if (botToken && order.telegramId) {
      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: order.telegramId,
          text:
            `✦ <b>XÁC NHẬN ĐÃ NHẬN THANH TOÁN</b> ✦\n\n` +
            `Kính gửi Quý khách,\n` +
            `Hệ thống <b>RINQ SHOP</b> đã nhận được khoản thanh toán <b>${order.totalAmount.toLocaleString(
              "vi-VN"
            )} đ</b> cho đơn hàng <code>${order.id}</code>.\n\n` +
            `Gói dịch vụ của Quý khách đang được hệ thống khởi tạo. Tài khoản bàn giao sẽ được gửi tới Quý khách trong ít phút.\n\n` +
            `Nếu cần hỗ trợ ưu tiên ngay lập tức, Quý khách vui lòng liên hệ Admin <b>@rinq_hotro</b>. Trân trọng cảm ơn Quý khách!`,
          parse_mode: "HTML",
        }),
      }).catch(() => {});
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "PAID_PENDING_FULFILLMENT",
        paidAt: new Date(),
      },
    });

    await prisma.appSetting.upsert({
      where: { key: txKey },
      update: { value: JSON.stringify(tx) },
      create: { key: txKey, value: JSON.stringify(tx) },
    }).catch(() => {});

    return { success: true, orderId: order.id, reason: "PAID_PENDING_FULFILLMENT" };
  }

  // Cấp hàng thành công: Thực hiện transaction DB
  const result = await prisma.$transaction(async (dbTx) => {
    for (const st of manualToDeliver) {
      await dbTx.stockItem.update({
        where: { id: st.id },
        data: { isSold: true, orderId: order.id },
      });
    }

    const createdApiStocks: any[] = [];
    for (const rawData of apiDeliveredTexts) {
      const item = await dbTx.stockItem.create({
        data: {
          productId: order.productId,
          data: encryptStock(rawData),
          isSold: true,
          orderId: order.id,
        },
      });
      createdApiStocks.push(item);
    }

    const updatedOrder = await dbTx.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
      },
    });

    return {
      order: updatedOrder,
      stocks: [...manualToDeliver, ...createdApiStocks],
    };
  });

  // Đánh dấu giao dịch đã hoàn tất
  await prisma.appSetting.upsert({
    where: { key: txKey },
    update: { value: JSON.stringify(tx) },
    create: { key: txKey, value: JSON.stringify(tx) },
  }).catch(() => {});

  // Gửi hàng về Telegram khách hàng
  if (botToken && result.order.telegramId) {
    if (qrMessageId) {
      fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: result.order.telegramId,
          message_id: qrMessageId,
        }),
      }).catch(() => {});
    }

    let keysText = "";
    if (result.stocks.length === 1) {
      keysText = `🔑 <b>TÀI NGUYÊN / TÀI KHOẢN CỦA QUÝ KHÁCH:</b>\n<code>${decryptStock(result.stocks[0].data)}</code>\n\n`;
    } else {
      keysText =
        `🔑 <b>DANH SÁCH TÀI NGUYÊN BÀN GIAO (${result.stocks.length} sản phẩm):</b>\n` +
        result.stocks.map((s, idx) => `<b>#${idx + 1}:</b> <code>${decryptStock(s.data)}</code>`).join("\n") +
        "\n\n";
    }

    const warrantyNotice = order.product.warranty?.trim()
      ? `<blockquote>🛡️ <b>CHÍNH SÁCH BẢO HÀNH:</b>\n${order.product.warranty.trim()}</blockquote>\n\n`
      : "";

    const message =
      `✦ <b>XÁC NHẬN GIAO DỊCH THÀNH CÔNG</b> ✦\n\n` +
      `Kính gửi Quý khách,\n` +
      `Hệ thống <b>RINQ SHOP</b> đã nhận được khoản thanh toán và hoàn tất giao dịch tự động của Quý khách:\n\n` +
      `🧾 <b>Mã đơn hàng:</b> <code>${result.order.id}</code>\n` +
      `📦 <b>Sản phẩm:</b> <b>${order.product.name}</b>\n` +
      `🔢 <b>Số lượng:</b> <b>${result.stocks.length} sản phẩm</b>\n` +
      `💰 <b>Tổng thanh toán:</b> <b>${order.totalAmount.toLocaleString("vi-VN")} đ</b>\n` +
      `🕒 <b>Thời gian ghi nhận:</b> ${new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}\n\n` +
      keysText +
      warrantyNotice +
      `<blockquote>💡 <i>Ghi chú: Quý khách chạm trực tiếp vào dòng mã trên để tự động sao chép toàn bộ.</i></blockquote>\n\n` +
      `RINQ SHOP xin chân thành cảm ơn Quý khách đã tin tưởng và đồng hành cùng chúng tôi.\n` +
      `Nếu cần hỗ trợ bảo hành hoặc tư vấn, Quý khách vui lòng liên hệ Admin <b>@rinq_hotro</b>. Trân trọng!`;

    const deliveryKeyboard = {
      inline_keyboard: [
        [
          { text: "📥 Tải file đơn (.txt)", callback_data: `dl_order:${result.order.id}` },
          { text: "📦 Đơn của tôi", callback_data: "inline_my_orders" },
        ],
        [
          { text: "🛒 Tiếp tục mua sắm", callback_data: "menu_products" },
          { text: "💬 Hỗ trợ (@rinq_hotro)", url: "https://t.me/rinq_hotro" },
        ],
      ],
    };

    fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: result.order.telegramId,
        text: message,
        parse_mode: "HTML",
        reply_markup: deliveryKeyboard,
      }),
    }).catch((tgErr) => console.error("Lỗi gửi hàng Telegram:", tgErr));

    // Báo Admin
    if (adminId) {
      const adminAlertMsg =
        `🔔 <b>[ĐƠN HÀNG MỚI THÀNH CÔNG · ACB api5s]</b>\n\n` +
        `🧾 <b>Mã đơn:</b> <code>#${result.order.id}</code>\n` +
        `👤 <b>Khách hàng:</b> <b>${order.username ? `@${order.username}` : (result.order.telegramId || "Khách vãng lai")}</b> (<code>${result.order.telegramId || "N/A"}</code>)\n` +
        `📦 <b>Sản phẩm:</b> <b>${order.product.name}</b> (x${result.stocks.length})\n` +
        `💰 <b>Doanh thu:</b> <b>+${order.totalAmount.toLocaleString("vi-VN")} đ</b>\n` +
        `🕒 <b>Thời gian:</b> ${new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`;

      const adminKeyboard = result.order.telegramId
        ? {
            inline_keyboard: [
              [
                order.username
                  ? { text: `💬 Nhắn @${order.username}`, url: `https://t.me/${order.username}` }
                  : { text: "💬 Nhắn khách hàng", url: `tg://user?id=${result.order.telegramId}` },
              ],
            ],
          }
        : undefined;

      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: adminId.trim(),
          text: adminAlertMsg,
          parse_mode: "HTML",
          reply_markup: adminKeyboard,
        }),
      }).catch(() => {});
    }
  }

  return { success: true, orderId: result.order.id };
}

// Hàm quét toàn bộ giao dịch mới từ api5s.com và tự động xử lý
export async function checkAndProcessApi5sPayments(): Promise<{
  checked: number;
  processed: number;
  errors: any[];
}> {
  if (isProcessingLock) {
    return { checked: 0, processed: 0, errors: ["LOCKED"] };
  }
  isProcessingLock = true;

  try {
    const transactions = await fetchApi5sTransactions();
    let processedCount = 0;
    const errors: any[] = [];

    for (const tx of transactions) {
      try {
        const res = await processApi5sTransaction(tx);
        if (res.success && res.reason !== "ALREADY_PROCESSED") {
          processedCount++;
        }
      } catch (err: any) {
        errors.push({ txId: tx.transactionID, error: err?.message || err });
      }
    }

    return {
      checked: transactions.length,
      processed: processedCount,
      errors,
    };
  } finally {
    isProcessingLock = false;
  }
}
