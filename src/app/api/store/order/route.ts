import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateCoupon, incrementCouponUsage } from "@/lib/promo";
import { decryptStock } from "@/lib/crypto";
import { randomBytes } from "crypto";
import { isBotOnline } from "@/lib/bot-status";

async function generateOrderId(): Promise<string> {
  for (let i = 0; i < 3; i++) {
    const orderId = `DH${randomBytes(16).toString("hex").toUpperCase()}`;
    const exists = await prisma.order.findUnique({ where: { id: orderId } });
    if (!exists) return orderId;
  }
  throw new Error("Không thể tạo mã đơn hàng duy nhất");
}

/**
 * POST /api/store/order
 * Tạo đơn hàng mới từ Web Storefront
 */
export async function POST(req: NextRequest) {
  try {
    const botOnline = await isBotOnline();
    if (!botOnline) {
      return NextResponse.json(
        { error: "Hệ thống đang chờ bot hoạt động, xin lỗi bạn vì sự bất tiện này!" },
        { status: 503 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      productId,
      quantity = 1,
      telegramId,
      telegramUser,
      firstName,
      couponCode,
    } = body;

    const prodId = Number(productId);
    const qty = Math.max(1, Number(quantity) || 1);

    if (!prodId) {
      return NextResponse.json({ error: "Sản phẩm không hợp lệ" }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id: prodId },
      include: {
        stocks: {
          where: { isSold: false },
          select: { id: true },
        },
      },
    });

    if (!product || !product.isActive) {
      return NextResponse.json({ error: "Sản phẩm không tồn tại hoặc đã ngừng bán" }, { status: 404 });
    }

    // Kiểm tra tồn kho
    const isApiSupplier = Boolean(product.supplierVariantId);
    if (!isApiSupplier && product.stocks.length < qty) {
      return NextResponse.json(
        { error: `Kho không đủ số lượng (Hiện còn ${product.stocks.length} sản phẩm)` },
        { status: 400 }
      );
    }

    // Tính giá
    let baseTotal = product.price * qty;
    let finalTotal = baseTotal;

    if (couponCode) {
      const couponCheck = await validateCoupon(couponCode, baseTotal);
      if (couponCheck.valid && couponCheck.finalPrice !== undefined) {
        finalTotal = couponCheck.finalPrice;
        await incrementCouponUsage(couponCode);
      }
    }

    const finalTgId = telegramId ? String(telegramId).trim() : "";
    if (!finalTgId || isNaN(Number(finalTgId)) || Number(finalTgId) <= 0) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập tài khoản Telegram để tiếp tục đặt hàng" },
        { status: 401 }
      );
    }

    const orderId = await generateOrderId();
    const rawUsername = telegramUser?.replace(/^@/, "").trim() || null;

    // Tự động lưu hoặc cập nhật thông tin TelegramUser vào cơ sở dữ liệu
    await prisma.telegramUser.upsert({
      where: { id: finalTgId },
      update: {
        username: rawUsername,
        firstName: firstName?.trim() || null,
      },
      create: {
        id: finalTgId,
        username: rawUsername,
        firstName: firstName?.trim() || null,
      },
    }).catch((e) => console.warn("Lỗi lưu TelegramUser:", e));

    const order = await prisma.order.create({
      data: {
        id: orderId,
        productId: product.id,
        telegramId: finalTgId,
        username: rawUsername,
        quantity: qty,
        totalAmount: finalTotal,
        status: "PENDING",
      },
    });

    const bankId = process.env.BANK_ID || "TPBank";
    const bankAccountNo = process.env.BANK_ACCOUNT_NO || "0123456789";
    const bankAccountName = process.env.BANK_ACCOUNT_NAME || "RINQ SHOP";

    // URL VietQR SePay
    const qrUrl = `https://qr.sepay.vn/img?bank=${encodeURIComponent(
      bankId
    )}&acc=${encodeURIComponent(bankAccountNo)}&template=compact&amount=${finalTotal}&des=${encodeURIComponent(
      order.id
    )}`;

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        productId: product.id,
        productName: product.name,
        quantity: qty,
        unitPrice: product.price,
        totalAmount: finalTotal,
        status: order.status,
        createdAt: order.createdAt,
      },
      payment: {
        bankId,
        bankAccountNo,
        bankAccountName,
        qrUrl,
        transferContent: order.id,
      },
    });
  } catch (error: any) {
    console.error("Lỗi tạo đơn web:", error);
    return NextResponse.json(
      { error: error?.message || "Lỗi tạo đơn hàng" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/store/order?orderId=DH...
 * Kiểm tra trạng thái đơn hàng realtime
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("orderId");

    if (!orderId) {
      return NextResponse.json({ error: "Thiếu mã đơn hàng" }, { status: 400 });
    }

    // Các mã sáu chữ số cũ có thể đoán được; không dùng chúng để trả trạng thái hay key qua HTTP.
    if (!/^DH[A-F0-9]{32}$/i.test(orderId)) {
      return NextResponse.json({ error: "Không tìm thấy đơn hàng" }, { status: 404 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        product: {
          select: { id: true, name: true, price: true },
        },
        stocks: {
          select: { id: true, data: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Không tìm thấy đơn hàng" }, { status: 404 });
    }

    if (order.status === "PAID") {
      const decryptedKeys = (order.stocks || []).map((s) => decryptStock(s.data));
      return NextResponse.json(
        {
          success: true,
          status: "PAID",
          orderId: order.id,
          productName: order.product?.name,
          totalAmount: order.totalAmount,
          quantity: order.quantity,
          paidAt: order.paidAt,
          keys: decryptedKeys,
        },
        { headers: { "Cache-Control": "no-store, private" } }
      );
    }

    return NextResponse.json(
      {
        success: true,
        status: order.status,
        orderId: order.id,
        productName: order.product?.name,
        totalAmount: order.totalAmount,
        quantity: order.quantity,
        createdAt: order.createdAt,
      },
      { headers: { "Cache-Control": "no-store, private" } }
    );
  } catch (error: any) {
    console.error("Lỗi kiểm tra đơn hàng:", error);
    return NextResponse.json(
      { error: error?.message || "Lỗi tra cứu đơn hàng" },
      { status: 500 }
    );
  }
}
