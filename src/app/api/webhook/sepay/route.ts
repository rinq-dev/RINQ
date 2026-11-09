import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fulfillFromSupplier } from "@/lib/supplier-fulfillment";
import { encryptStock, decryptStock } from "@/lib/crypto";
import { timingSafeEqual } from "crypto";
import { COOKIE_NAME, isValidAdminSession } from "@/lib/admin-session";
import { isSupportedOrderId } from "@/lib/order-policy";

export async function GET() {
  return NextResponse.json({
    success: true,
    service: "RINQ SHOP SePay Webhook",
    status: "ready",
  });
}

export async function POST(req: NextRequest) {
  let claimedOrderId: string | null = null;
  try {
    const configuredApiKey = process.env.SEPAY_API_KEY || "";
    const suppliedAuthorization = req.headers.get("authorization") || "";
    const suppliedApiKey =
      suppliedAuthorization.match(/^(?:Apikey|Bearer)\s+(.+)$/i)?.[1] ||
      suppliedAuthorization.trim() ||
      req.headers.get("x-api-key") ||
      req.headers.get("sepay-api-key") ||
      "";

    const apiKeyMatches =
      Boolean(configuredApiKey) &&
      Boolean(suppliedApiKey) &&
      (configuredApiKey === suppliedApiKey || (() => {
        try {
          const expected = Buffer.from(configuredApiKey);
          const supplied = Buffer.from(suppliedApiKey);
          return expected.length === supplied.length && timingSafeEqual(expected, supplied);
        } catch {
          return false;
        }
      })());

    const adminSession =
      process.env.NODE_ENV !== "production" &&
      req.headers.get("origin") === req.nextUrl.origin &&
      (await isValidAdminSession(req.cookies.get(COOKIE_NAME)?.value));

    if (!adminSession && (!configuredApiKey || !apiKeyMatches)) {
      console.warn("SePay Webhook rejected: invalid or missing authentication.");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));

    const rawContent =
      body.content ||
      body.description ||
      body.code ||
      body.orderId ||
      "";

    const transferAmount = Number(body.transferAmount ?? body.amount);

    if (!Number.isSafeInteger(transferAmount) || transferAmount <= 0) {
      return NextResponse.json({ error: "Thiếu hoặc sai số tiền giao dịch" }, { status: 400 });
    }

    if (!adminSession && String(body.transferType || "").toLowerCase() !== "in") {
      return NextResponse.json({ error: "Chỉ chấp nhận giao dịch tiền vào" }, { status: 400 });
    }

    // 1. Payment matching must use the full, unambiguous order ID.
    const match = String(rawContent).match(/DH(?:[A-F0-9]{32}|[A-F0-9]{12}|[A-F0-9]{8})(?![A-F0-9])/i);
    const orderIdCandidate = match && isSupportedOrderId(match[0]) ? match[0].toUpperCase() : null;

    // 2. Deposit matching for wallet top-up (NAP...)
    const napMatch = String(rawContent).match(/NAP(?:[A-F0-9]{8}|[A-F0-9]{12}|[0-9]{5,15})(?![A-F0-9])/i);
    const napCandidate = napMatch ? napMatch[0].toUpperCase() : null;

    // Xử lý nạp tiền vào ví
    if (napCandidate && !orderIdCandidate) {
      let tx = await prisma.walletTransaction.findUnique({
        where: { id: napCandidate },
      });

      let targetTelegramId = tx?.telegramId || null;

      if (!tx) {
        const possibleTgId = napCandidate.replace(/^NAP/, "");
        const user = await prisma.telegramUser.findUnique({
          where: { id: possibleTgId },
        });
        if (user) {
          targetTelegramId = user.id;
          tx = await prisma.walletTransaction.create({
            data: {
              id: napCandidate,
              telegramId: user.id,
              amount: transferAmount,
              type: "DEPOSIT",
              status: "PENDING",
              description: "Nạp tiền ví SePay tự động",
            },
          });
        }
      }

      if (!tx || !targetTelegramId) {
        return NextResponse.json({
          success: true,
          message: `Bỏ qua giao dịch: Không tìm thấy mã nạp ví ${napCandidate}`,
          napId: napCandidate,
        });
      }

      if (tx.status === "SUCCESS") {
        return NextResponse.json({
          success: true,
          message: `Giao dịch nạp ví ${tx.id} đã hoàn tất trước đó.`,
          napId: tx.id,
        });
      }

      // Cập nhật trạng thái giao dịch & cộng số dư ví
      const updatedUser = await prisma.$transaction(async (prismaTx) => {
        await prismaTx.walletTransaction.update({
          where: { id: tx!.id },
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

      const botToken = process.env.BOT_TOKEN;

      // Xóa tin nhắn QR nạp tiền nếu có
      if (botToken && tx.qrMessageId) {
        try {
          await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: targetTelegramId,
              message_id: tx.qrMessageId,
            }),
          });
        } catch {}
      }

      // Thông báo cho khách hàng qua Telegram
      if (botToken) {
        const notifyMsg =
          `🎉 <b>NẠP TIỀN VÀO VÍ THÀNH CÔNG!</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `Kính gửi Quý khách, hệ thống đã ghi nhận khoản nạp tiền vào ví:\n\n` +
          `➕ <b>Số tiền nạp:</b> <b>+${transferAmount.toLocaleString("vi-VN")} đ</b>\n` +
          `💳 <b>Số dư ví hiện tại:</b> <b>${(updatedUser.balance || 0).toLocaleString("vi-VN")} đ</b>\n` +
          `🧾 <b>Mã giao dịch:</b> <code>${tx.id}</code>\n` +
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

        // Báo cho Admin
        const adminId = process.env.ADMIN_TELEGRAM_ID;
        if (adminId && adminId !== targetTelegramId) {
          fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: adminId,
              text:
                `💰 <b>KHÁCH NẠP TIỀN VÍ THÀNH CÔNG</b>\n` +
                `• Khách: <code>${targetTelegramId}</code>\n` +
                `• Số tiền: <b>+${transferAmount.toLocaleString("vi-VN")} đ</b>\n` +
                `• Số dư mới: <b>${(updatedUser.balance || 0).toLocaleString("vi-VN")} đ</b>\n` +
                `• Mã GD: <code>${tx.id}</code>`,
              parse_mode: "HTML",
            }),
          }).catch(() => {});
        }
      }

      return NextResponse.json({
        success: true,
        message: `Đã nạp ${transferAmount}đ vào ví cho tài khoản ${targetTelegramId}`,
        napId: tx.id,
      });
    }

    if (!orderIdCandidate) {
      return NextResponse.json({ error: "Thiếu mã đơn hàng (DH...) hoặc mã nạp tiền (NAP...) trong nội dung giao dịch" }, { status: 400 });
    }

    const order: any = await prisma.order.findUnique({
      where: { id: orderIdCandidate },
      include: { product: true },
    });

    if (!order) {
      return NextResponse.json({
        success: true,
        message: `Bỏ qua giao dịch: Không tìm thấy đơn hàng mã ${orderIdCandidate || "N/A"}`,
        orderId: orderIdCandidate,
      });
    }

    const orderId = order.id;

    if (order.status === "PAID") {
      return NextResponse.json({
        success: true,
        message: `Đơn hàng ${orderId} đã được thanh toán trước đó.`,
        orderId,
      });
    }

    if (order.status !== "PENDING") {
      if (order.status === "PROCESSING" || order.status === "PAID_PENDING_FULFILLMENT") {
        return NextResponse.json({ success: true, message: `Đơn ${order.id} đã nhận thanh toán và đang được xử lý.` });
      }
      return NextResponse.json({ error: `Đơn hàng không ở trạng thái chờ thanh toán (${order.status})` }, { status: 409 });
    }

    if (transferAmount !== order.totalAmount) {
      return NextResponse.json(
        {
          error: `Số tiền chuyển (${transferAmount}đ) không đủ so với giá trị đơn hàng (${order.totalAmount}đ)`,
        },
        { status: 400 }
      );
    }

    // Atomically claim the order. Duplicate or concurrent webhook deliveries cannot fulfill twice.
    const claimed = await prisma.order.updateMany({
      where: { id: order.id, status: "PENDING" },
      data: { status: "PROCESSING" },
    });
    if (claimed.count !== 1) {
      return NextResponse.json({ success: true, message: `Đơn ${order.id} đang được xử lý hoặc đã xử lý.` });
    }
    claimedOrderId = order.id;

    // Lấy số lượng đặt mua thực tế và mã tin nhắn QR từ DB
    const orderQty = order.quantity || 1;
    const qrMessageId = order.qrMessageId || null;

    const supplierVariantId = order.product?.supplierVariantId || null;
    const fulfillmentType = order.product?.fulfillmentType || "HYBRID";

    // Tìm tài nguyên còn tồn trong kho nội bộ
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
      if (availableStocks.length < orderQty) {
        throw new Error("OUT_OF_STOCK");
      }
      manualToDeliver.push(...availableStocks);
    } else if (fulfillmentType === "API") {
      needFromApiQty = orderQty;
    } else {
      // Chế độ HYBRID (Mặc định): Ưu tiên kho thủ công, nếu thiếu bao nhiêu thì tự động mua bấy nhiêu qua API
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
      if (!supplierVariantId || !supplierVariantId.trim()) {
        if (manualToDeliver.length < orderQty) {
          throw new Error("OUT_OF_STOCK");
        }
      } else {
        // Tự động gọi API NCC (Hỗ trợ cả ScoopyVN và RoboticVN)
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

    // Nếu không đủ cả kho thủ công và API bị lỗi:
    if (manualToDeliver.length + apiDeliveredTexts.length < orderQty) {
      console.error("Lỗi cấp hàng tự động:", supplierErrorMsg);
      const botToken = process.env.BOT_TOKEN;
      const adminId = process.env.ADMIN_TELEGRAM_ID;

      // Bắn tin báo lỗi riêng cho Admin (Khách hoàn toàn không thấy thông tin này)
      if (botToken && adminId) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: adminId,
            text:
              `⚠️ <b>CẢNH BÁO ĐƠN HÀNG CẦN XỬ LÝ GẤP</b>\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `🧾 <b>Mã đơn:</b> <code>${order.id}</code>\n` +
              `📦 <b>Sản phẩm:</b> <b>${order.product.name}</b> (SL: ${orderQty})\n` +
              `💰 <b>Tiền đã nhận:</b> <b>${order.totalAmount.toLocaleString("vi-VN")} đ</b>\n` +
              `👤 <b>Khách hàng:</b> @${order.username || order.telegramId}\n` +
              `⚠️ <b>Lý do:</b> Kho thủ công thiếu & API NCC báo lỗi: <code>${
                supplierErrorMsg || "Số dư ví 0đ / Chưa nạp tiền"
              }</code>\n\n` +
              `👉 <i>Vui lòng nạp tiền vào ví NCC hoặc gửi hàng thủ công cho khách!</i>`,
            parse_mode: "HTML",
          }),
        }).catch(() => {});
      }

      // Thông báo lịch sự, chuyên nghiệp cho khách (giữ bí mật nguồn hàng)
      if (botToken && order.telegramId) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: order.telegramId,
            text:
              `✦ <b>XÁC NHẬN ĐÃ NHẬN THANH TOÁN</b> ✦\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `Kính gửi Quý khách,\n` +
              `Hệ thống <b>RINQ SHOP</b> đã nhận được khoản thanh toán <b>${order.totalAmount.toLocaleString(
                "vi-VN"
              )} đ</b> cho đơn hàng <code>${order.id}</code>.\n\n` +
              `Gói dịch vụ của Quý khách đang được chuyên viên hệ thống khởi tạo tự động. Tài khoản bàn giao sẽ được gửi tới Quý khách trong ít phút.\n\n` +
              `Nếu cần hỗ trợ ưu tiên ngay lập tức, Quý khách vui lòng liên hệ Admin <b>@rinq_hotro</b>. Trân trọng cảm ơn Quý khách!`,
            parse_mode: "HTML",
          }),
        }).catch(() => {});
      }

      // Vẫn cập nhật trạng thái PAID để lưu giữ đơn hàng hợp lệ
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: "PAID_PENDING_FULFILLMENT",
          paidAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: `Đã xác nhận thanh toán đơn ${orderId}. Cần cấp hàng bổ sung do lỗi API: ${supplierErrorMsg}`,
        orderId: order.id,
      });
    }

    // Thực hiện Transaction: Cập nhật stock thủ công + tạo stock từ API đã bàn giao
    const result = await prisma.$transaction(async (tx) => {
      // Đánh dấu các stock thủ công đã bán
      for (const st of manualToDeliver) {
        const reserved = await tx.stockItem.updateMany({
          where: { id: st.id, isSold: false },
          data: {
            isSold: true,
            orderId: order.id,
          },
        });
        if (reserved.count !== 1) throw new Error("STOCK_RACE");
      }

      // Lưu các tài khoản nhận từ API vào DB với cờ đã bán
      const createdApiStocks: any[] = [];
      for (const rawData of apiDeliveredTexts) {
        const item = await tx.stockItem.create({
          data: {
            productId: order.productId,
            data: encryptStock(rawData),
            isSold: true,
            orderId: order.id,
          },
        });
        createdApiStocks.push(item);
      }

      // Cập nhật trạng thái Order thành PAID
      const updatedOrder = await tx.order.update({
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

    // Gửi thông báo và hàng về Telegram khách hàng qua Bot API
    const botToken = process.env.BOT_TOKEN;
    if (botToken && result.order.telegramId) {
      // 1. Tự động xóa tin nhắn mã QR thanh toán trên Telegram để khung chat sạch đẹp
      if (qrMessageId) {
        try {
          await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: result.order.telegramId,
              message_id: qrMessageId,
            }),
          });
        } catch (delErr) {
          console.error("Lỗi xóa tin nhắn mã QR:", delErr);
        }
      }

      // 2. Định dạng thông tin tài nguyên sản phẩm bàn giao
      let keysText = "";
      if (result.stocks.length === 1) {
        keysText = `🔑 <b>TÀI NGUYÊN / TÀI KHOẢN CỦA QUÝ KHÁCH:</b>\n<code>${decryptStock(result.stocks[0].data)}</code>\n\n`;
      } else {
        keysText =
          `🔑 <b>DANH SÁCH TÀI NGUYÊN BÀN GIAO (${result.stocks.length} sản phẩm):</b>\n` +
          result.stocks.map((s, idx) => `<b>#${idx + 1}:</b> <code>${decryptStock(s.data)}</code>`).join("\n") +
          "\n\n";
      }

      const warrantyNotice = order.product.warranty
        ? `<blockquote>🛡️ <b>CHÍNH SÁCH BẢO HÀNH:</b>\n${order.product.warranty.trim()}</blockquote>\n\n`
        : "";

      const message =
        `✦ <b>XÁC NHẬN GIAO DỊCH THÀNH CÔNG</b> ✦\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Kính gửi Quý khách,\n` +
        `Hệ thống <b>RINQ SHOP</b> đã nhận được khoản thanh toán và hoàn tất giao dịch tự động của Quý khách:\n\n` +
        `🧾 <b>Mã đơn hàng:</b> <code>${result.order.id}</code>\n` +
        `📦 <b>Sản phẩm:</b> <b>${order.product.name}</b>\n` +
        `🔢 <b>Số lượng:</b> <b>${result.stocks.length} sản phẩm</b>\n` +
        `💰 <b>Tổng thanh toán:</b> <b>${order.totalAmount.toLocaleString("vi-VN")} đ</b>\n` +
        `🕒 <b>Thời gian ghi nhận:</b> ${new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        keysText +
        warrantyNotice +
        `<blockquote>💡 <i>Ghi chú: Quý khách chạm trực tiếp vào dòng mã trên để tự động sao chép toàn bộ.</i></blockquote>\n\n` +
        `RINQ SHOP xin chân thành cảm ơn Quý khách đã tin tưởng và đồng hành cùng chúng tôi.\n` +
        `Nếu cần hỗ trợ bảo hành hoặc tư vấn, Quý khách vui lòng liên hệ Admin <b>@rinq_hotro</b> để được phục vụ chu đáo nhất. Trân trọng!`;

      const deliveryKeyboard = {
        inline_keyboard: [
          [
            { text: "🛒 Tiếp tục mua sắm", callback_data: "menu_products" },
            { text: "📦 Lịch sử đơn hàng", callback_data: "inline_my_orders" },
          ],
          [
            { text: "💬 Hỗ trợ bảo hành (@rinq_hotro)", url: "https://t.me/rinq_hotro" },
          ],
        ],
      };

      try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: result.order.telegramId,
            text: message,
            parse_mode: "HTML",
            reply_markup: deliveryKeyboard,
          }),
        });
      } catch (tgError) {
        console.error("Lỗi gửi tin nhắn Telegram:", tgError);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Đơn hàng ${orderId} đã duyệt thành công và đã phát hàng.`,
      orderId: result.order.id,
    });
  } catch (error: any) {
    if (claimedOrderId) {
      await prisma.order.updateMany({
        where: { id: claimedOrderId, status: "PROCESSING" },
        data: { status: "PAID_PENDING_FULFILLMENT", paidAt: new Date() },
      }).catch(() => {});
    }
    if (error?.message === "OUT_OF_STOCK") {
      return NextResponse.json(
        { error: "Kho đã hết hàng cho sản phẩm này! Vui lòng nạp thêm hàng vào kho." },
        { status: 409 }
      );
    }

    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { error: error?.message || "Lỗi xử lý webhook" },
      { status: 500 }
    );
  }
}
