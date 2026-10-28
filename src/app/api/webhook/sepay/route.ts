import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupplierOrder, getSupplierDelivery } from "@/lib/supplier";
import { encryptStock, decryptStock } from "@/lib/crypto";
import { timingSafeEqual } from "crypto";
import { COOKIE_NAME, isValidAdminSession } from "@/lib/admin-session";

export async function GET() {
  return NextResponse.json({
    success: true,
    service: "RINQ SHOP SePay Webhook",
    status: "ready",
  });
}

export async function POST(req: NextRequest) {
  try {
    const configuredApiKey = process.env.SEPAY_API_KEY || "";
    const suppliedAuthorization = req.headers.get("authorization") || "";
    const suppliedApiKey = suppliedAuthorization.match(/^Apikey\s+(.+)$/i)?.[1] || "";
    const adminSession =
      req.headers.get("origin") === req.nextUrl.origin &&
      (await isValidAdminSession(req.cookies.get(COOKIE_NAME)?.value));
    const apiKeyMatches = Boolean(configuredApiKey) && (() => {
      const expected = Buffer.from(configuredApiKey);
      const supplied = Buffer.from(suppliedApiKey);
      return expected.length === supplied.length && timingSafeEqual(expected, supplied);
    })();

    if (!adminSession && !apiKeyMatches) {
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

    const match = String(rawContent).match(/DH(?:\d{6,12}|[A-F0-9]{32})/i);
    const orderId = match ? match[0].toUpperCase() : (body.orderId ? String(body.orderId).toUpperCase() : null);

    if (!orderId) {
      return NextResponse.json({ error: "Không tìm thấy mã đơn trong giao dịch" }, { status: 400 });
    }

    if (!Number.isSafeInteger(transferAmount) || transferAmount <= 0) {
      return NextResponse.json({ error: "Thiếu hoặc sai số tiền giao dịch" }, { status: 400 });
    }

    if (!adminSession && String(body.transferType || "").toLowerCase() !== "in") {
      return NextResponse.json({ error: "Chỉ chấp nhận giao dịch tiền vào" }, { status: 400 });
    }

    // Tìm đơn hàng trong DB
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        product: true,
      },
    });

    if (!order) {
      return NextResponse.json({
        success: true,
        message: `Bỏ qua giao dịch: Không tìm thấy đơn hàng mã ${orderId}`,
        orderId,
      });
    }

    if (order.status === "PAID") {
      return NextResponse.json({
        success: true,
        message: `Đơn hàng ${orderId} đã được thanh toán trước đó.`,
        orderId,
      });
    }

    if (transferAmount < order.totalAmount) {
      return NextResponse.json(
        {
          error: `Số tiền chuyển (${transferAmount}đ) không đủ so với giá trị đơn hàng (${order.totalAmount}đ)`,
        },
        { status: 400 }
      );
    }

    // Lấy số lượng đặt mua thực tế và mã tin nhắn QR từ DB
    let orderQty = 1;
    let qrMessageId: number | null = null;
    try {
      const qRows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT quantity, qrMessageId FROM "Order" WHERE id = ?`,
        orderId
      );
      if (qRows && qRows.length > 0) {
        if (qRows[0].quantity) orderQty = Number(qRows[0].quantity);
        if (qRows[0].qrMessageId) qrMessageId = Number(qRows[0].qrMessageId);
      }
    } catch {
      orderQty = (order as any).quantity || 1;
    }

    // Lấy thông tin cấu hình mở rộng của sản phẩm (supplierVariantId, fulfillmentType)
    let productExt: any = null;
    try {
      const pRows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT supplierVariantId, fulfillmentType FROM "Product" WHERE id = ?`,
        order.productId
      );
      if (pRows && pRows.length > 0) {
        productExt = pRows[0];
      }
    } catch (e) {
      console.warn("Không thể tải cấu hình NCC của sản phẩm:", e);
    }

    const supplierVariantId =
      productExt?.supplierVariantId || (order.product as any)?.supplierVariantId;
    const fulfillmentType =
      productExt?.fulfillmentType ||
      (order.product as any)?.fulfillmentType ||
      "HYBRID";

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
        // Tự động gọi API NCC Likesub3s
        const supOrder = await createSupplierOrder(
          supplierVariantId.trim(),
          needFromApiQty
        );
        if (supOrder.success && supOrder.orderId) {
          const supDelivery = await getSupplierDelivery(supOrder.orderId);
          if (supDelivery.success && supDelivery.items.length > 0) {
            apiDeliveredTexts.push(...supDelivery.items.map((it) => it.rawText));
          } else {
            supplierErrorMsg =
              supDelivery.error || "Chưa nhận được bàn giao từ NCC";
          }
        } else {
          supplierErrorMsg = supOrder.error || "Lỗi tạo đơn qua API NCC";
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
              `Nếu cần hỗ trợ ưu tiên ngay lập tức, Quý khách vui lòng liên hệ Admin <b>@zophim</b>. Trân trọng cảm ơn Quý khách!`,
            parse_mode: "HTML",
          }),
        }).catch(() => {});
      }

      // Vẫn cập nhật trạng thái PAID để lưu giữ đơn hàng hợp lệ
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: "PAID",
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
        await tx.stockItem.update({
          where: { id: st.id },
          data: {
            isSold: true,
            orderId: order.id,
          },
        });
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
        `<blockquote>💡 <i>Ghi chú: Quý khách chạm trực tiếp vào dòng mã trên để tự động sao chép toàn bộ.</i></blockquote>\n\n` +
        `RINQ SHOP xin chân thành cảm ơn Quý khách đã tin tưởng và đồng hành cùng chúng tôi.\n` +
        `Nếu cần hỗ trợ bảo hành hoặc tư vấn, Quý khách vui lòng liên hệ Admin <b>@zophim</b> để được phục vụ chu đáo nhất. Trân trọng!`;

      const deliveryKeyboard = {
        inline_keyboard: [
          [
            { text: "🛒 Tiếp tục mua sắm", callback_data: "menu_products" },
            { text: "📦 Lịch sử đơn hàng", callback_data: "inline_my_orders" },
          ],
          [
            { text: "💬 Hỗ trợ bảo hành (@zophim)", url: "https://t.me/zophim" },
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
