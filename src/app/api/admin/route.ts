import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  addSubscriber,
  countSubscribers,
  broadcastStockAlert,
  broadcastCustomMessage,
  broadcastPriceUpdate,
} from "@/lib/notifier";
import {
  getAllCoupons,
  createCoupon,
  updateCoupon,
  toggleCoupon,
  deleteCoupon,
  getAllGiveaways,
  createGiveaway,
  drawGiveawayWinners,
  deleteGiveaway,
} from "@/lib/promo";
import { getSupplierInfo, fetchSupplierProducts } from "@/lib/supplier";
import { encryptStock, decryptStock } from "@/lib/crypto";
import { notifyRestockSubscribers } from "@/lib/restock";
import { COOKIE_NAME, isValidAdminSession } from "@/lib/admin-session";
import { isBotOnline } from "@/lib/bot-status";
import { getPaymentSettings } from "@/lib/app-settings";
import {
  getActiveFlashSale,
  startFlashSale,
  stopFlashSale,
} from "@/lib/flash-sale";

function isValidBroadcastUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function escapeBroadcastHtml(value: string) {
  return value.replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[char]!));
}

async function checkAuth(req: NextRequest): Promise<boolean> {
  return isValidAdminSession(req.cookies.get(COOKIE_NAME)?.value);
}

function isValidProductImage(value: string | null): boolean {
  if (!value) return true;
  if (value.length > 650_000) return false;
  if (/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(value)) return true;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && value.length <= 2048;
  } catch {
    return false;
  }
}

function jsonResponse(data: any, status = 200) {
  const serialized = JSON.stringify(data, (_, v) =>
    typeof v === "bigint" ? Number(v) : v
  );
  return new NextResponse(serialized, {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, private",
    },
  });
}

export async function GET(req: NextRequest) {
  if (!(await checkAuth(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Nhóm 1: Dữ liệu sản phẩm, cấu hình shop và hệ thống
    const [products, coupons, giveaways, botOnline, paymentSettings] = await Promise.all([
      prisma.product.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          stocks: {
            select: {
              id: true,
              isSold: true,
            },
          },
        },
      }),
      getAllCoupons().catch(() => []),
      getAllGiveaways().catch(() => []),
      isBotOnline().catch(() => false),
      getPaymentSettings().catch(() => ({ bankId: "ACB", accountNo: "", accountName: "", api5sToken: "" })),
    ]);

    // Nhóm 2: Đơn hàng, khách hàng và nhà cung cấp
    const [orders, orderStats, telegramUsers, customerOrders, supplierInfo] = await Promise.all([
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              price: true,
            },
          },
          stocks: {
            select: {
              id: true,
              data: true,
            },
          },
        },
      }),
      prisma.order.groupBy({
        by: ["status"],
        _count: { id: true },
        _sum: { totalAmount: true },
      }).catch(() => []),
      prisma.telegramUser.findMany({ orderBy: { createdAt: "desc" } }).catch(() => []),
      prisma.order.findMany({
        take: 500,
        select: { telegramId: true, totalAmount: true, status: true, createdAt: true },
      }).catch(() => []),
      getSupplierInfo().catch(() => ({ connected: false, balanceVnd: 0, balanceUsd: 0 })),
    ]);

    let totalStockAvailable = 0;
    let totalStockSold = 0;

    const productsWithStockCounts = products.map((p) => {
      let unsold = 0;
      let sold = 0;
      for (const s of p.stocks) {
        if (s.isSold) {
          sold++;
          totalStockSold++;
        } else {
          unsold++;
          totalStockAvailable++;
        }
      }
      return {
        id: p.id,
        name: p.name,
        price: p.price,
        description: p.description,
        category: p.category,
        warranty: p.warranty || null,
        priceNote: p.priceNote || null,
        imageUrl: p.imageUrl?.startsWith("data:image/") ? `/api/admin/product-image/${p.id}` : p.imageUrl || null,
        supplierVariantId: p.supplierVariantId || null,
        fulfillmentType: p.fulfillmentType || "HYBRID",
        retailMarginPercent: p.retailMarginPercent ?? 15,
        isActive: p.isActive,
        createdAt: p.createdAt,
        stockAvailable: unsold,
        stockSold: sold,
        totalStock: p.stocks.length,
      };
    });

    let totalRevenue = 0;
    let totalOrders = 0;
    let paidOrders = 0;
    let pendingOrders = 0;
    let fulfillmentPendingOrders = 0;

    for (const stat of orderStats) {
      const count = stat._count?.id || 0;
      totalOrders += count;
      if (["PAID", "PAID_PENDING_FULFILLMENT"].includes(stat.status)) {
        paidOrders += count;
        totalRevenue += stat._sum?.totalAmount || 0;
      }
      if (stat.status === "PENDING") {
        pendingOrders += count;
      }
      if (["PROCESSING", "PAID_PENDING_FULFILLMENT"].includes(stat.status)) {
        fulfillmentPendingOrders += count;
      }
    }

    const subscriberSet = new Set<string>();
    telegramUsers.forEach((u) => { if (u.id) subscriberSet.add(String(u.id).trim()); });
    customerOrders.forEach((o) => { if (o.telegramId) subscriberSet.add(String(o.telegramId).trim()); });
    const adminTelegramId = process.env.ADMIN_TELEGRAM_ID;
    if (adminTelegramId && adminTelegramId.trim()) subscriberSet.add(adminTelegramId.trim());
    const subscriberCount = subscriberSet.size;

    const customerMap = new Map<string, {
      id: string;
      username: string | null;
      firstName: string | null;
      balance: number;
      createdAt: string;
      orderCount: number;
      paidOrderCount: number;
      totalSpent: number;
      lastOrderAt: string | null;
      source: "telegram" | "order";
    }>();
    telegramUsers.forEach((user) => customerMap.set(user.id, {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      balance: (user as any).balance || 0,
      createdAt: user.createdAt.toISOString(),
      orderCount: 0,
      paidOrderCount: 0,
      totalSpent: 0,
      lastOrderAt: null,
      source: "telegram",
    }));
    customerOrders.forEach((order) => {
      const current = customerMap.get(order.telegramId) || {
        id: order.telegramId,
        username: null,
        firstName: null,
        balance: 0,
        createdAt: order.createdAt.toISOString(),
        orderCount: 0,
        paidOrderCount: 0,
        totalSpent: 0,
        lastOrderAt: null,
        source: "order" as const,
      };
      current.orderCount += 1;
      if (["PAID", "PAID_PENDING_FULFILLMENT", "PROCESSING"].includes(order.status)) {
        current.paidOrderCount += 1;
        current.totalSpent += order.totalAmount;
      }
      if (!current.lastOrderAt || order.createdAt > new Date(current.lastOrderAt)) {
        current.lastOrderAt = order.createdAt.toISOString();
      }
      customerMap.set(order.telegramId, current);
    });

    const decryptedOrders = orders.map((o) => ({
      ...o,
      stocks: o.stocks?.map((st) => ({
        ...st,
        data: decryptStock(st.data),
      })),
    }));

    return jsonResponse({
      success: true,
      products: productsWithStockCounts,
      orders: decryptedOrders,
      coupons,
      giveaways,
      customers: Array.from(customerMap.values()).sort((a, b) =>
        new Date(b.lastOrderAt || b.createdAt).getTime() - new Date(a.lastOrderAt || a.createdAt).getTime()
      ),
      supplier: supplierInfo,
      flashSale: await getActiveFlashSale(),
      systemStatus: {
        botOnline,
        sepayConfigured: Boolean(process.env.SEPAY_API_KEY?.trim()),
        api5sConfigured: Boolean(paymentSettings.api5sToken),
        allowPaymentSimulation: process.env.NODE_ENV !== "production",
        bankId: paymentSettings.bankId,
        bankAccountNo: paymentSettings.accountNo,
      },
      stats: {
        totalRevenue,
        totalOrders,
        paidOrders,
        pendingOrders,
        fulfillmentPendingOrders,
        totalStockAvailable,
        totalStockSold,
        subscriberCount,
        activeCoupons: coupons.filter((c: any) => Boolean(c.isActive)).length,
        activeGiveaways: giveaways.filter((g: any) => g.status === "ACTIVE").length,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

async function executeAdminAction(body: any) {
  const { action } = body;

  switch (action) {
      case "startFlashSale": {
        const { discountPercent, durationHours, title, note, broadcastToBot } = body;
        const pct = parseInt(String(discountPercent), 10);
        const hrs = parseFloat(String(durationHours)) || 2;
        const t = typeof title === "string" && title.trim() ? title.trim() : "⚡ GIỜ VÀNG FLASH SALE";
        const n = typeof note === "string" && note.trim() ? note.trim() : null;

        if (isNaN(pct) || pct <= 0 || pct > 90) {
          return NextResponse.json({ error: "Mức giảm giá phải từ 1% đến 90%" }, { status: 400 });
        }

        const config = await startFlashSale(pct, hrs, t, n);

        if (broadcastToBot !== false) {
          try {
            const subscribers = await prisma.telegramUser.findMany({ select: { id: true } });
            const botToken = process.env.BOT_TOKEN;
            if (botToken && subscribers.length > 0) {
              const noteBlock = n ? `\n\n📝 <b>Thông điệp từ Shop:</b>\n<i>${n}</i>` : "";
              const msg =
                `🔥 <b>${config.title.toUpperCase()} · RINQ SHOP</b> 🔥\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `Kính gửi Quý khách, cửa hàng đang mở chương trình ưu đãi đặc biệt:\n\n` +
                `💥 Giảm ngay <b>${config.discountPercent}%</b> cho tất cả các gói dịch vụ!\n` +
                `⏱ Áp dụng trong <b>${hrs} giờ</b> tới (hết hạn: ${new Date(config.expiresAt).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}).` +
                noteBlock +
                `\n\n👉 Kính mời Quý khách bấm <b>🗂 Xem sản phẩm</b> để săn sale ngay!`;

              const keyboard = {
                inline_keyboard: [[{ text: "🛒 Săn sale ngay", callback_data: "menu_products" }]],
              };

              for (const sub of subscribers) {
                fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: sub.id,
                    text: msg,
                    parse_mode: "HTML",
                    reply_markup: keyboard,
                  }),
                }).catch(() => {});
              }
            }
          } catch (bcErr) {
            console.error("Lỗi broadcast flash sale từ web:", bcErr);
          }
        }

        return NextResponse.json({ success: true, flashSale: config });
      }

      case "stopFlashSale": {
        await stopFlashSale();
        return NextResponse.json({ success: true });
      }

      case "getFlashSale": {
        const config = await getActiveFlashSale();
        return NextResponse.json({ success: true, flashSale: config });
      }

      case "RENAME_CATEGORY": {
        const oldName = typeof body.oldName === "string" ? body.oldName.trim() : "";
        const newName = typeof body.newName === "string" ? body.newName.trim() : "";
        if (!oldName || !newName) {
          return NextResponse.json({ error: "Tên danh mục không được để trống" }, { status: 400 });
        }
        if (newName.length > 120) {
          return NextResponse.json({ error: "Tên danh mục tối đa 120 ký tự" }, { status: 400 });
        }
        if (oldName === newName) {
          return NextResponse.json({ error: "Tên mới đang trùng tên cũ" }, { status: 400 });
        }

        const where = oldName === "Chưa phân loại"
          ? { OR: [{ category: null }, { category: "" }] }
          : { category: oldName };
        const result = await prisma.product.updateMany({
          where,
          data: { category: newName },
        });

        return jsonResponse({ success: true, count: result.count, oldName, newName });
      }

      case "CREATE_PRODUCT": {
        const {
          name,
          price,
          description,
          category,
          warranty,
          imageUrl,
          supplierVariantId,
          fulfillmentType,
          retailMarginPercent,
        } = body;
        if (!name || price === undefined) {
          return NextResponse.json(
            { error: "Tên và giá sản phẩm là bắt buộc" },
            { status: 400 }
          );
        }

        const sVarId = supplierVariantId ? String(supplierVariantId).trim() : null;
        const fType = fulfillmentType ? String(fulfillmentType).trim() : "HYBRID";
        const img = imageUrl ? String(imageUrl).trim() : null;
        if (!isValidProductImage(img)) {
          return NextResponse.json({ error: "Ảnh cần là URL http(s) hoặc ảnh JPEG/PNG/WebP đã nén dưới 450 KB." }, { status: 400 });
        }
        const warr = warranty ? String(warranty).trim() : null;

        const product = await prisma.product.create({
          data: {
            name: String(name).trim(),
            price: Math.max(0, parseInt(String(price), 10)),
            description: description ? String(description).trim() : null,
            category: category ? String(category).trim() : null,
            warranty: warr,
            supplierVariantId: sVarId,
            fulfillmentType: fType,
            retailMarginPercent: Number.isFinite(Number(retailMarginPercent)) ? Math.max(0, Math.min(100, Math.round(Number(retailMarginPercent)))) : 15,
            imageUrl: img,
            isActive: true,
          },
        });

        return NextResponse.json({
          success: true,
          product,
        });
      }

      case "UPDATE_PRODUCT": {
        const {
          id,
          name,
          price,
          description,
          category,
          warranty,
          priceReason,
          imageUrl,
          notifyUsers,
          supplierVariantId,
          fulfillmentType,
          retailMarginPercent,
        } = body;
        if (id === undefined) {
          return NextResponse.json({ error: "Thiếu product id" }, { status: 400 });
        }
        const targetId = Number(id);
        const oldProduct = await prisma.product.findUnique({
          where: { id: targetId },
        });
        if (!oldProduct) {
          return NextResponse.json({ error: "Sản phẩm không tồn tại" }, { status: 404 });
        }

        const newPriceNumber =
          price !== undefined
            ? Math.max(0, parseInt(String(price), 10))
            : oldProduct.price;
        const newName =
          name !== undefined ? String(name).trim() : oldProduct.name;

        const finalNote = priceReason !== undefined
          ? (priceReason ? String(priceReason).trim() : null)
          : oldProduct.priceNote;
        const finalWarranty = warranty !== undefined
          ? (warranty ? String(warranty).trim() : null)
          : oldProduct.warranty;
        const sVarId = supplierVariantId !== undefined
          ? (supplierVariantId ? String(supplierVariantId).trim() : null)
          : oldProduct.supplierVariantId;
        const fType = fulfillmentType !== undefined
          ? (fulfillmentType ? String(fulfillmentType).trim() : "HYBRID")
          : (oldProduct.fulfillmentType || "HYBRID");
        const requestedImage = imageUrl !== undefined
          ? (imageUrl ? String(imageUrl).trim() : null)
          : oldProduct.imageUrl;
        const img = requestedImage === `/api/admin/product-image/${targetId}`
          ? oldProduct.imageUrl
          : requestedImage;
        if (!isValidProductImage(img)) {
          return NextResponse.json({ error: "Ảnh cần là URL http(s) hoặc ảnh JPEG/PNG/WebP đã nén dưới 450 KB." }, { status: 400 });
        }

        const updated = await prisma.product.update({
          where: { id: targetId },
          data: {
            name: newName,
            price: newPriceNumber,
            description:
              description !== undefined
                ? description
                  ? String(description).trim()
                  : null
                : oldProduct.description,
            category:
              category !== undefined
                ? category
                  ? String(category).trim()
                  : null
                : oldProduct.category,
            warranty: finalWarranty,
            priceNote: finalNote,
            supplierVariantId: sVarId,
            fulfillmentType: fType,
            ...(retailMarginPercent !== undefined ? { retailMarginPercent: Math.max(0, Math.min(100, Math.round(Number(retailMarginPercent)))) } : {}),
            imageUrl: img,
          },
        });

        let notifyResult: any = null;
        if (notifyUsers && oldProduct.price !== updated.price) {
          notifyResult = await broadcastPriceUpdate({
            productId: updated.id,
            productName: updated.name,
            oldPrice: oldProduct.price,
            newPrice: updated.price,
            priceReason: priceReason ? String(priceReason).trim() : undefined,
          });
        }

        return jsonResponse({
          success: true,
          product: updated,
          notifyResult,
        });
      }

      case "TOGGLE_PRODUCT": {
        const { id, isActive } = body;
        if (id === undefined) {
          return NextResponse.json({ error: "Thiếu product id" }, { status: 400 });
        }
        const updated = await prisma.product.update({
          where: { id: Number(id) },
          data: { isActive: Boolean(isActive) },
        });
        return NextResponse.json({ success: true, product: updated });
      }

      case "DELETE_PRODUCT": {
        const { id, reason, notifyUsers, force } = body;
        if (id === undefined) {
          return NextResponse.json({ error: "Thiếu product id" }, { status: 400 });
        }
        const productId = Number(id);
        const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, name: true, price: true } });
        if (!product) return jsonResponse({ error: "Sản phẩm không tồn tại" }, 404);
        const deletionReason = typeof reason === "string" ? reason.trim().slice(0, 500) : "";
        if (notifyUsers && !deletionReason) return jsonResponse({ error: "Cần nhập lý do trước khi gửi thông báo" }, 400);

        const paidOrders = await prisma.order.count({
          where: { productId, status: { in: ["PROCESSING", "PAID_PENDING_FULFILLMENT", "PAID"] } },
        });
        if (paidOrders > 0 && !force) {
          return jsonResponse({
            error: `Sản phẩm này có ${paidOrders} đơn hàng trong lịch sử. Bạn có chắc chắn muốn xóa vĩnh viễn (kèm đơn và tồn kho liên quan)?`,
            hasPaidOrders: true,
            paidOrdersCount: paidOrders,
          }, 409);
        }

        await prisma.$transaction(async (tx) => {
          // 1. Gỡ liên kết SupplierPurchase
          await tx.supplierPurchase.updateMany({
            where: { targetProductId: productId },
            data: { targetProductId: null },
          });

          // 2. Xóa RestockSubscription
          await tx.restockSubscription.deleteMany({
            where: { productId },
          });

          // 3. Tìm tất cả đơn hàng gắn với sản phẩm này
          const relatedOrders = await tx.order.findMany({
            where: { productId },
            select: { id: true },
          });
          const orderIds = relatedOrders.map((o) => o.id);

          // 4. Xóa toàn bộ StockItem thuộc về sản phẩm hoặc đã gán cho các đơn này
          await tx.stockItem.deleteMany({
            where: {
              OR: [
                { productId },
                ...(orderIds.length > 0 ? [{ orderId: { in: orderIds } }] : []),
              ],
            },
          });

          // 5. Xóa các đơn hàng liên quan
          if (orderIds.length > 0) {
            await tx.order.deleteMany({
              where: { id: { in: orderIds } },
            });
          }

          // 6. Xóa sản phẩm
          await tx.product.deleteMany({
            where: { id: productId },
          });
        });

        let notifyResult: any = null;
        if (notifyUsers && deletionReason) {
          notifyResult = await broadcastCustomMessage({
            title: `Sản phẩm ngừng cung cấp: ${escapeBroadcastHtml(product.name)}`,
            text: `Sản phẩm <b>${escapeBroadcastHtml(product.name)}</b> đã được gỡ khỏi shop.\n\nLý do: ${escapeBroadcastHtml(deletionReason)}`,
          }).catch((error) => ({ success: false, error: error instanceof Error ? error.message : "Không gửi được thông báo" }));
        }
        return NextResponse.json({ success: true, notifyResult });
      }

      case "BULK_IMPORT": {
        const { productId, rawLines, notifyUsers } = body;
        if (!productId || typeof rawLines !== "string") {
          return NextResponse.json(
            { error: "Vui lòng chọn sản phẩm và nhập dữ liệu tài khoản/key" },
            { status: 400 }
          );
        }

        const lines = rawLines
          .split(/\r?\n/)
          .map((line: string) => line.trim())
          .filter((line: string) => line.length > 0);

        if (lines.length === 0) {
          return NextResponse.json(
            { error: "Không tìm thấy dòng dữ liệu hợp lệ" },
            { status: 400 }
          );
        }

        const targetProductId = Number(productId);
        const created = await prisma.stockItem.createMany({
          data: lines.map((line: string) => ({
            productId: targetProductId,
            data: encryptStock(line),
            isSold: false,
          })),
        });

        // Bắn thông báo hàng mới đến khách hàng nếu được bật
        let notifyResult: any = null;
        if (notifyUsers !== false) {
          const product = await prisma.product.findUnique({
            where: { id: targetProductId },
          });
          const totalStock = await prisma.stockItem.count({
            where: { productId: targetProductId, isSold: false },
          });

          if (product) {
            notifyResult = await broadcastStockAlert({
              productId: product.id,
              productName: product.name,
              price: product.price,
              addedCount: created.count,
              totalStock,
            });
          }
        }

        // Gửi thông báo trực tiếp đến những người đã đăng ký nhận thông báo có hàng (Restock Alert)
        notifyRestockSubscribers(targetProductId, created.count).catch((err) => {
          console.warn("Lỗi notifyRestockSubscribers:", err);
        });

        return NextResponse.json({
          success: true,
          count: created.count,
          notifyResult,
        });
      }

      case "NOTIFY_RESTOCK": {
        const { productId } = body;
        if (!productId) {
          return NextResponse.json({ error: "Thiếu productId" }, { status: 400 });
        }
        const targetProductId = Number(productId);
        const product = await prisma.product.findUnique({
          where: { id: targetProductId },
        });
        if (!product) {
          return NextResponse.json({ error: "Sản phẩm không tồn tại" }, { status: 404 });
        }
        const totalStock = await prisma.stockItem.count({
          where: { productId: targetProductId, isSold: false },
        });

        const notifyResult = await broadcastStockAlert({
          productId: product.id,
          productName: product.name,
          price: product.price,
          addedCount: 0,
          totalStock,
        });

        return NextResponse.json({ success: true, notifyResult });
      }

      case "BROADCAST_CUSTOM": {
        const { title, message, imageUrl, buttonText, buttonUrl } = body;
        if (!message || !message.trim()) {
          return NextResponse.json({ error: "Nội dung thông báo không được để trống" }, { status: 400 });
        }
        if (imageUrl && !isValidBroadcastUrl(imageUrl)) {
          return NextResponse.json({ error: "Ảnh phải là URL HTTPS công khai" }, { status: 400 });
        }
        if ((buttonText && !buttonUrl) || (!buttonText && buttonUrl) || (buttonUrl && !isValidBroadcastUrl(buttonUrl))) {
          return NextResponse.json({ error: "Nút CTA cần tên và URL HTTPS hợp lệ" }, { status: 400 });
        }
        const result = await broadcastCustomMessage({
          title: title ? String(title).trim().slice(0, 120) : undefined,
          text: String(message).trim(),
          imageUrl: imageUrl ? String(imageUrl).trim() : undefined,
          buttonText: buttonText ? String(buttonText).trim() : undefined,
          buttonUrl: buttonUrl ? String(buttonUrl).trim() : undefined,
        });
        return NextResponse.json({ success: true, result });
      }

      // ---- COUPON ACTIONS ----
      case "CREATE_COUPON": {
        const { code, discount, isPercent, maxUsage } = body;
        if (!code || !discount) {
          return NextResponse.json({ error: "Vui lòng nhập mã và mức giảm giá" }, { status: 400 });
        }
        try {
          const result = await createCoupon({
            code: String(code),
            discount: parseInt(String(discount), 10),
            isPercent: Boolean(isPercent),
            maxUsage: parseInt(String(maxUsage || 100), 10),
          });
          return NextResponse.json({ success: true, result });
        } catch (err: any) {
          return NextResponse.json({ error: "Mã giảm giá này đã tồn tại!" }, { status: 400 });
        }
      }

      case "TOGGLE_COUPON": {
        const { id, isActive } = body;
        await toggleCoupon(
          Number(id),
          isActive !== undefined ? Boolean(isActive) : undefined
        );
        return jsonResponse({ success: true });
      }

      case "UPDATE_COUPON": {
        const { id, code, discount, isPercent, maxUsage, usedCount, isActive } = body;
        if (!id) {
          return jsonResponse({ error: "Thiếu coupon id" }, 400);
        }
        const result = await updateCoupon({
          id: Number(id),
          code: code ? String(code) : undefined,
          discount: discount !== undefined ? parseInt(String(discount), 10) : undefined,
          isPercent: isPercent !== undefined ? Boolean(isPercent) : undefined,
          maxUsage: maxUsage !== undefined ? parseInt(String(maxUsage), 10) : undefined,
          usedCount: usedCount !== undefined ? parseInt(String(usedCount), 10) : undefined,
          isActive: isActive !== undefined ? Boolean(isActive) : undefined,
        });
        if (result.error) {
          return jsonResponse({ error: result.error }, 400);
        }
        return jsonResponse({ success: true });
      }

      case "DELETE_COUPON": {
        const { id } = body;
        await deleteCoupon(Number(id));
        return jsonResponse({ success: true });
      }

      // ---- ORDER ACTIONS ----
      case "COMPLETE_MANUAL_FULFILLMENT": {
        const orderId = String(body.orderId || "").trim();
        const keys: string[] = Array.isArray(body.keys)
          ? body.keys.map((key: unknown) => String(key).trim()).filter(Boolean)
          : [];
        if (!orderId || !keys.length) {
          return jsonResponse({ error: "Thiếu mã đơn hoặc key bàn giao" }, 400);
        }

        const order = await prisma.order.findUnique({
          where: { id: orderId },
          include: { product: { select: { name: true, warranty: true } } },
        });
        if (!order) return jsonResponse({ error: "Không tìm thấy đơn hàng" }, 404);
        if (order.status !== "PAID_PENDING_FULFILLMENT") {
          return jsonResponse({ error: "Đơn không ở trạng thái đã nhận tiền, cần cấp hàng" }, 409);
        }
        if (keys.length !== order.quantity) {
          return jsonResponse({ error: `Đơn cần đúng ${order.quantity} key; hiện có ${keys.length}` }, 400);
        }

        await prisma.$transaction(async (tx) => {
          const claimed = await tx.order.updateMany({
            where: { id: order.id, status: "PAID_PENDING_FULFILLMENT" },
            data: { status: "PROCESSING" },
          });
          if (claimed.count !== 1) throw new Error("ORDER_ALREADY_UPDATED");
          for (const key of keys) {
            await tx.stockItem.create({
              data: {
                productId: order.productId,
                data: encryptStock(key),
                isSold: true,
                orderId: order.id,
              },
            });
          }
          await tx.order.update({
            where: { id: order.id },
            data: { status: "PAID", paidAt: order.paidAt || new Date() },
          });
        });

        const escapeHtml = (value: string) => value.replace(/[&<>\"]/g, (char) => ({
          "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;",
        })[char] || char);
        const keyLines = keys.map((key, index) => keys.length === 1
          ? `<code>${escapeHtml(key)}</code>`
          : `<b>#${index + 1}</b> <code>${escapeHtml(key)}</code>`).join("\n");
        const warranty = order.product.warranty
          ? `\n\n<b>Bảo hành:</b> ${escapeHtml(order.product.warranty)}`
          : "";
        const botToken = process.env.BOT_TOKEN;
        let customerNotified = false;
        if (botToken) {
          const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: order.telegramId,
              text: `✅ <b>ĐÃ HOÀN TẤT ĐƠN HÀNG</b>\n\nMã đơn: <code>${order.id}</code>\nSản phẩm: <b>${escapeHtml(order.product.name)}</b>\n\n${keyLines}${warranty}\n\nCần hỗ trợ? Liên hệ @rinq_hotro.`,
              parse_mode: "HTML",
            }),
          }).catch(() => null);
          customerNotified = Boolean(response?.ok);
        }
        return jsonResponse({ success: true, customerNotified, message: customerNotified
          ? `Đã cấp ${keys.length} key và gửi thông báo Telegram.`
          : `Đã lưu ${keys.length} key. Chưa gửi được Telegram; khách vẫn xem được key trên web.` });
      }

      case "DELETE_ORDER": {
        const rawId = body.id || body.orderId;
        if (!rawId) {
          return jsonResponse({ error: "Thiếu mã đơn hàng" }, 400);
        }
        const orderIdStr = String(rawId).trim();
        const deleted = await prisma.order.deleteMany({
          where: { id: orderIdStr, status: { in: ["PENDING", "CANCELLED", "EXPIRED"] } },
        });
        if (deleted.count !== 1) {
          return jsonResponse({ error: "Chỉ xóa được đơn chưa thanh toán, đã hủy hoặc hết hạn." }, 409);
        }
        return jsonResponse({ success: true, message: `Đã xóa đơn ${orderIdStr}` });
      }

      case "DELETE_ORDERS": {
        const { ids, onlyPending } = body;
        if (onlyPending) {
          await prisma.order.deleteMany({
            where: { status: "PENDING" },
          });
          return jsonResponse({ success: true, message: "Đã dọn sạch toàn bộ đơn chờ thanh toán" });
        }
        if (Array.isArray(ids) && ids.length > 0) {
          const stringIds = ids.map((item: any) => String(item).trim());
          const deleted = await prisma.order.deleteMany({
            where: { id: { in: stringIds }, status: { in: ["PENDING", "CANCELLED", "EXPIRED"] } },
          });
          return jsonResponse({ success: true, message: `Đã xóa ${deleted.count} đơn chưa thanh toán/đã hủy/hết hạn.` });
        }
        return jsonResponse({ error: "Thiếu danh sách đơn hàng cần xóa" }, 400);
      }

      // ---- GIVEAWAY ACTIONS ----
      case "CREATE_GIVEAWAY": {
        const { title, reward, description, winnerCount } = body;
        if (!title || !reward) {
          return NextResponse.json({ error: "Vui lòng nhập tên sự kiện và phần thưởng" }, { status: 400 });
        }
        await createGiveaway({
          title: String(title),
          reward: String(reward),
          description: description ? String(description) : undefined,
          winnerCount: Math.max(1, parseInt(String(winnerCount || 1), 10)),
        });
        return NextResponse.json({ success: true });
      }

      case "DRAW_GIVEAWAY": {
        const { giveawayId } = body;
        if (!giveawayId) {
          return NextResponse.json({ error: "Thiếu giveawayId" }, { status: 400 });
        }
        const result = await drawGiveawayWinners(Number(giveawayId));
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }

        // Bắn thông báo trúng thưởng qua Telegram Bot
        const botToken = process.env.BOT_TOKEN;
        if (botToken && result.winners && result.winners.length > 0) {
          for (const w of result.winners) {
            try {
              const text =
                `🎉 <b>CHÚC MỪNG BẠN ĐÃ TRÚNG GIVEAWAY!</b>\n\n` +
                `🏆 Sự kiện: <b>${result.ga.title}</b>\n` +
                `🎁 Phần thưởng: <b>${result.ga.reward}</b>\n\n` +
                `👉 Vui lòng liên hệ Admin <b>@rinq_hotro</b> (https://t.me/rinq_hotro) để nhận thưởng ngay!`;
              await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: w.telegramId,
                  text,
                  parse_mode: "HTML",
                }),
              });
            } catch (tgErr) {
              console.error("Lỗi gửi thông báo trúng GA:", tgErr);
            }
          }
        }

        return jsonResponse({ success: true, winners: result.winners });
      }

      case "DELETE_GIVEAWAY": {
        const { giveawayId } = body;
        await deleteGiveaway(Number(giveawayId));
        return NextResponse.json({ success: true });
      }

      case "TEST_SUPPLIER": {
        const info = await getSupplierInfo();
        return jsonResponse({ success: true, supplier: info });
      }

      case "SYNC_SUPPLIER_PRODUCTS": {
        const maxPrice = Number(body?.maxPrice || 40000);
        // Tỷ lệ tăng giá để có lãi (mặc định +15% và làm tròn lên hàng nghìn)
        const profitMargin = Math.max(5, Math.min(50, Number(body?.profitMargin || 15)));
        const supplierRes = await fetchSupplierProducts(maxPrice);
        if (!supplierRes.success) {
          return jsonResponse(
            { success: false, error: `Lỗi từ NCC RoboticVN: ${supplierRes.error || "Không thể lấy danh sách sản phẩm"}` },
            400
          );
        }

        let addedCount = 0;
        let updatedCount = 0;

        for (const item of supplierRes.products) {
          // Giá bán ra = Giá gốc NCC * (1 + % lãi), làm tròn lên hàng nghìn
          const retailPrice = Math.max(1000, Math.ceil((item.price * (1 + profitMargin / 100)) / 1000) * 1000);

          const existing = await prisma.product.findFirst({
            where: {
              OR: [
                { supplierVariantId: item.variantId },
                { name: item.title },
              ],
            },
          });

          if (existing) {
            await prisma.product.update({
              where: { id: existing.id },
              data: {
                name: item.title,
                price: retailPrice,
                category: item.category,
                description: item.description || existing.description,
                supplierVariantId: item.variantId,
                fulfillmentType: "HYBRID",
                ...(item.thumbnail && !existing.imageUrl ? { imageUrl: item.thumbnail } : {}),
              },
            });
            updatedCount++;
          } else {
            await prisma.product.create({
              data: {
                name: item.title,
                price: retailPrice,
                description: item.description || null,
                category: item.category || "AI",
                supplierVariantId: item.variantId,
                fulfillmentType: "HYBRID",
                imageUrl: item.thumbnail || null,
                isActive: true,
              },
            });
            addedCount++;
          }
        }

        return jsonResponse({
          success: true,
          addedCount,
          updatedCount,
          total: supplierRes.products.length,
          message: `Đã đồng bộ ${addedCount} sản phẩm mới và cập nhật ${updatedCount} sản phẩm (giá <= ${maxPrice.toLocaleString("vi-VN")}đ).`,
        });
      }

      case "APPROVE_ORDER": {
        const orderId = String(body?.orderId || "").trim();
        const customKey = typeof body?.customKey === "string" ? body.customKey.trim() : "";
        if (!orderId) {
          return jsonResponse({ error: "Thiếu mã đơn hàng cần duyệt" }, 400);
        }

        const order = await prisma.order.findUnique({
          where: { id: orderId },
          include: {
            product: true,
            stocks: true,
          },
        });

        if (!order) {
          return jsonResponse({ error: "Không tìm thấy đơn hàng" }, 404);
        }

        const qty = Math.max(1, order.quantity || 1);
        let keysToDeliver: string[] = [];

        // 1. Nếu admin truyền key cụ thể
        if (customKey) {
          const enc = encryptStock(customKey);
          await prisma.stockItem.create({
            data: {
              productId: order.productId,
              data: enc,
              isSold: true,
              orderId: order.id,
            },
          });
          keysToDeliver.push(customKey);
        } else if (order.stocks && order.stocks.length >= qty) {
          // 2. Đơn đã có đủ stock gán trước
          keysToDeliver = order.stocks.map((s) => decryptStock(s.data));
        } else {
          // 3. Tìm stock sẵn có trong kho nội bộ
          const currentCount = order.stocks?.length || 0;
          const needed = qty - currentCount;
          const availableStocks = await prisma.stockItem.findMany({
            where: {
              productId: order.productId,
              isSold: false,
              isFaulty: false,
            },
            take: needed,
            orderBy: { id: "asc" },
          });

          if (availableStocks.length > 0) {
            await prisma.$transaction(
              availableStocks.map((s) =>
                prisma.stockItem.update({
                  where: { id: s.id },
                  data: { isSold: true, orderId: order.id },
                })
              )
            );
            const decryptedNew = availableStocks.map((s) => decryptStock(s.data));
            const existingDecrypted = (order.stocks || []).map((s) => decryptStock(s.data));
            keysToDeliver = [...existingDecrypted, ...decryptedNew];
          }

          // 4. Nếu vẫn còn thiếu và sản phẩm có liên kết NCC RoboticVN -> gọi API mua tự động
          if (keysToDeliver.length < qty && order.product?.supplierVariantId) {
            try {
              const { createSupplierOrder, getSupplierDelivery } = await import("@/lib/supplier");
              const purchaseRes = await createSupplierOrder(
                order.product.supplierVariantId,
                qty - keysToDeliver.length
              );
              if (purchaseRes.success && purchaseRes.orderId) {
                const deliveryRes = await getSupplierDelivery(purchaseRes.orderId);
                if (deliveryRes.success && deliveryRes.items && deliveryRes.items.length > 0) {
                  for (const item of deliveryRes.items) {
                    const rawKey = item.rawText;
                    await prisma.stockItem.create({
                      data: {
                        productId: order.productId,
                        data: encryptStock(rawKey),
                        isSold: true,
                        orderId: order.id,
                      },
                    });
                    keysToDeliver.push(rawKey);
                  }
                }
              }
            } catch (supErr) {
              console.error("Lỗi mua tự động qua NCC:", supErr);
            }
          }
        }

        // Cập nhật trạng thái đơn hàng
        const finalStatus = keysToDeliver.length >= qty ? "PAID" : "PAID_PENDING_FULFILLMENT";
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: finalStatus,
            paidAt: new Date(),
          },
        });

        // Gửi thông báo & tài nguyên bàn giao tới Telegram khách hàng
        const botToken = process.env.BOT_TOKEN;
        if (botToken && order.telegramId) {
          let customerMsg = "";
          if (finalStatus === "PAID" && keysToDeliver.length > 0) {
            customerMsg =
              `🎉 <b>ĐƠN HÀNG ĐÃ ĐƯỢC DUYỆT THÀNH CÔNG!</b>\n\n` +
              `Kính gửi Quý khách, đơn hàng <code>#${order.id}</code> của Quý khách đã được Admin kiểm tra và duyệt hoàn tất:\n\n` +
              `📦 <b>Sản phẩm:</b> ${order.product?.name || "Sản phẩm"}\n` +
              `🔢 <b>Số lượng:</b> ${qty}\n` +
              `💰 <b>Số tiền:</b> ${order.totalAmount.toLocaleString("vi-VN")} đ\n\n` +
              `🔑 <b>Tài nguyên bàn giao:</b>\n` +
              `<code>${keysToDeliver.map((k, i) => `#${i + 1}: ${k}`).join("\n")}</code>\n\n` +
              `<blockquote>💡 <i>Chạm vào mã để sao chép. Nếu cần hỗ trợ thêm, Quý khách vui lòng liên hệ Admin @rinq_hotro.</i></blockquote>`;
          } else {
            customerMsg =
              `✅ <b>ĐƠN HÀNG ĐÃ ĐƯỢC DUYỆT THANH TOÁN!</b>\n\n` +
              `Kính gửi Quý khách, đơn hàng <code>#${order.id}</code> (${order.product?.name || "Sản phẩm"}) đã được Admin duyệt thành công.\n\n` +
              `⏳ Do kho đang chuẩn bị tài nguyên mới, Admin sẽ gửi tài nguyên cho Quý khách trong ít phút qua tin nhắn này.\n\n` +
              `Cảm ơn Quý khách đã mua sắm tại RINQ SHOP!`;
          }

          fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
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

        return jsonResponse({
          success: true,
          status: finalStatus,
          keysDelivered: keysToDeliver.length,
          message:
            finalStatus === "PAID"
              ? `Đã duyệt đơn #${order.id} và bàn giao ${keysToDeliver.length} tài nguyên cho khách!`
              : `Đã duyệt đơn #${order.id}. Do thiếu kho, đơn chuyển sang trạng thái "Cần cấp hàng".`,
        });
      }

      case "CREDIT_BALANCE": {
        const customerId = String(body?.customerId || body?.telegramId || "").trim();
        const amount = Math.round(Number(body?.amount || 0));
        const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

        if (!customerId) {
          return jsonResponse({ error: "Thiếu Telegram ID của khách hàng" }, 400);
        }
        if (amount <= 0) {
          return jsonResponse({ error: "Số tiền cộng phải lớn hơn 0đ" }, 400);
        }

        const updatedUser = await prisma.telegramUser.upsert({
          where: { id: customerId },
          update: {
            balance: { increment: amount },
          },
          create: {
            id: customerId,
            balance: amount,
          },
        });

        const txId = `ADJ${Date.now().toString(36).toUpperCase()}`;
        await prisma.walletTransaction.create({
          data: {
            id: txId,
            telegramId: customerId,
            amount: amount,
            type: "ADMIN_ADJUST",
            status: "SUCCESS",
            description: reason || "Admin cộng tiền ví",
          },
        }).catch(() => {});

        // Gửi thông báo tới Telegram của khách hàng
        const botToken = process.env.BOT_TOKEN;
        if (botToken) {
          const notifyText =
            `💰 <b>BIẾN ĐỘNG SỐ DƯ VÍ RINQ SHOP</b>\n\n` +
            `➕ <b>+${amount.toLocaleString("vi-VN")} đ</b>\n` +
            `• Lý do: <b>${reason || "Admin cộng tiền / Hoàn tiền đơn hàng"}</b>\n` +
            `• Số dư ví hiện tại: <b>${(updatedUser.balance || 0).toLocaleString("vi-VN")} đ</b>\n\n` +
            `<blockquote>💡 <i>Quý khách có thể sử dụng số dư này để thanh toán ngay cho mọi sản phẩm trên Bot!</i></blockquote>`;

          fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: customerId,
              text: notifyText,
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [{ text: "🛍 Mua hàng ngay", url: "https://t.me/rinq_bot" }],
                  [{ text: "💬 Hỗ trợ Admin (@rinq_hotro)", url: "https://t.me/rinq_hotro" }],
                ],
              },
            }),
          }).catch(() => {});
        }

        return jsonResponse({
          success: true,
          balance: updatedUser.balance,
          message: `Đã cộng thành công ${amount.toLocaleString("vi-VN")}đ vào ví của khách (ID: ${customerId})!`,
        });
      }

      default:
        return NextResponse.json({ error: "Action không hợp lệ" }, { status: 400 });
    }
}

export async function POST(req: NextRequest) {
  if (!(await checkAuth(req)) || req.headers.get("origin") !== req.nextUrl.origin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await executeAdminAction(body);
    } catch (error: any) {
      const isConnectionTimeout =
        typeof error?.message === "string" &&
        (error.message.includes("timeout exceeded when trying to connect") ||
          error.message.includes("Connection terminated") ||
          error.message.includes("connection"));
      if (isConnectionTimeout && attempt < 2) {
        await new Promise((r) => setTimeout(r, 600));
        continue;
      }
      return NextResponse.json(
        { error: error?.message || "Internal server error" },
        { status: 500 }
      );
    }
  }
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
