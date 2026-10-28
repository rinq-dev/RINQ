import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
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
import { COOKIE_NAME, isValidAdminSession } from "@/lib/admin-session";

async function checkAuth(req: NextRequest): Promise<boolean> {
  return isValidAdminSession(req.cookies.get(COOKIE_NAME)?.value);
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
    const products = await prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        stocks: {
          select: {
            id: true,
            isSold: true,
          },
        },
      },
    });

    let rawProductMap = new Map<number, any>();
    try {
      const rawProducts = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, priceNote, supplierVariantId, fulfillmentType, imageUrl FROM "Product"`
      );
      if (rawProducts && Array.isArray(rawProducts)) {
        rawProductMap = new Map(rawProducts.map((r) => [Number(r.id), r]));
      }
    } catch (e) {
      console.warn("Không thể tải cột mở rộng sản phẩm:", e);
    }

    const supplierInfo = await getSupplierInfo();

    const productsWithStockCounts = products.map((p) => {
      const unsold = p.stocks.filter((s) => !s.isSold).length;
      const sold = p.stocks.filter((s) => s.isSold).length;
      const raw = rawProductMap.get(p.id);
      return {
        id: p.id,
        name: p.name,
        price: p.price,
        description: p.description,
        category: p.category,
        priceNote: raw?.priceNote || (p as any).priceNote || null,
        imageUrl: raw?.imageUrl || null,
        supplierVariantId: raw?.supplierVariantId || null,
        fulfillmentType: raw?.fulfillmentType || "HYBRID",
        isActive: p.isActive,
        createdAt: p.createdAt,
        stockAvailable: unsold,
        stockSold: sold,
        totalStock: p.stocks.length,
      };
    });

    const orders = await prisma.order.findMany({
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
    });

    // Thống kê tổng quan
    const totalRevenueResult = await prisma.order.aggregate({
      _sum: {
        totalAmount: true,
      },
      where: {
        status: "PAID",
      },
    });

    const totalOrders = await prisma.order.count();
    const paidOrders = await prisma.order.count({ where: { status: "PAID" } });
    const pendingOrders = await prisma.order.count({ where: { status: "PENDING" } });

    const totalStockAvailable = await prisma.stockItem.count({
      where: { isSold: false },
    });
    const totalStockSold = await prisma.stockItem.count({
      where: { isSold: true },
    });

    const subscriberCount = await countSubscribers();
    const coupons = await getAllCoupons();
    const giveaways = await getAllGiveaways();

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
      supplier: supplierInfo,
      stats: {
        totalRevenue: totalRevenueResult._sum.totalAmount || 0,
        totalOrders,
        paidOrders,
        pendingOrders,
        totalStockAvailable,
        totalStockSold,
        subscriberCount,
        activeCoupons: coupons.filter((c: any) => c.isActive === 1).length,
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

export async function POST(req: NextRequest) {
  if (!(await checkAuth(req)) || req.headers.get("origin") !== req.nextUrl.origin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "CREATE_PRODUCT": {
        const {
          name,
          price,
          description,
          category,
          imageUrl,
          supplierVariantId,
          fulfillmentType,
        } = body;
        if (!name || price === undefined) {
          return NextResponse.json(
            { error: "Tên và giá sản phẩm là bắt buộc" },
            { status: 400 }
          );
        }

        const product = await prisma.product.create({
          data: {
            name: String(name).trim(),
            price: Math.max(0, parseInt(String(price), 10)),
            description: description ? String(description).trim() : null,
            category: category ? String(category).trim() : null,
            isActive: true,
          },
        });

        const sVarId = supplierVariantId ? String(supplierVariantId).trim() : null;
        const fType = fulfillmentType ? String(fulfillmentType).trim() : "HYBRID";
        const img = imageUrl ? String(imageUrl).trim() : null;
        await prisma.$executeRawUnsafe(
          `UPDATE "Product" SET supplierVariantId = ?, fulfillmentType = ?, imageUrl = ? WHERE id = ?`,
          sVarId,
          fType,
          img,
          product.id
        );

        return NextResponse.json({
          success: true,
          product: {
            ...product,
            supplierVariantId: sVarId,
            fulfillmentType: fType,
            imageUrl: img,
          },
        });
      }

      case "UPDATE_PRODUCT": {
        const {
          id,
          name,
          price,
          description,
          category,
          priceReason,
          imageUrl,
          notifyUsers,
          supplierVariantId,
          fulfillmentType,
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
          },
        });

        // Cập nhật priceNote, supplierVariantId, fulfillmentType, imageUrl trực tiếp bằng SQLite raw
        const finalNote = priceReason !== undefined
          ? (priceReason ? String(priceReason).trim() : null)
          : (oldProduct as any).priceNote;
        const sVarId = supplierVariantId !== undefined
          ? (supplierVariantId ? String(supplierVariantId).trim() : null)
          : (oldProduct as any).supplierVariantId;
        const fType = fulfillmentType !== undefined
          ? (fulfillmentType ? String(fulfillmentType).trim() : "HYBRID")
          : ((oldProduct as any).fulfillmentType || "HYBRID");
        const img = imageUrl !== undefined
          ? (imageUrl ? String(imageUrl).trim() : null)
          : (oldProduct as any).imageUrl;

        await prisma.$executeRawUnsafe(
          `UPDATE "Product" SET priceNote = ?, supplierVariantId = ?, fulfillmentType = ?, imageUrl = ? WHERE id = ?`,
          finalNote,
          sVarId,
          fType,
          img,
          targetId
        );
        (updated as any).priceNote = finalNote;
        (updated as any).supplierVariantId = sVarId;
        (updated as any).fulfillmentType = fType;
        (updated as any).imageUrl = img;

        let notifyResult: any = null;
        if (notifyUsers) {
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
        const { id } = body;
        if (id === undefined) {
          return NextResponse.json({ error: "Thiếu product id" }, { status: 400 });
        }
        const productId = Number(id);

        await prisma.$transaction(async (tx) => {
          // 1. Tìm tất cả đơn hàng gắn với sản phẩm này
          const relatedOrders = await tx.order.findMany({
            where: { productId },
            select: { id: true },
          });
          const orderIds = relatedOrders.map((o) => o.id);

          // 2. Xóa toàn bộ StockItem thuộc về sản phẩm hoặc đã gán cho các đơn này
          await tx.stockItem.deleteMany({
            where: {
              OR: [
                { productId },
                ...(orderIds.length > 0 ? [{ orderId: { in: orderIds } }] : []),
              ],
            },
          });

          // 3. Xóa các đơn hàng liên quan
          if (orderIds.length > 0) {
            await tx.order.deleteMany({
              where: { id: { in: orderIds } },
            });
          }

          // 4. Xóa sản phẩm
          await tx.product.delete({
            where: { id: productId },
          });
        });

        return NextResponse.json({ success: true });
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
        const { message } = body;
        if (!message || !message.trim()) {
          return NextResponse.json({ error: "Nội dung thông báo không được để trống" }, { status: 400 });
        }
        const result = await broadcastCustomMessage(String(message).trim());
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
      case "DELETE_ORDER": {
        const { id } = body;
        if (!id) {
          return jsonResponse({ error: "Thiếu mã đơn hàng" }, 400);
        }
        const orderIdStr = String(id).trim();
        // Nhả liên kết tài nguyên đã gán về kho nếu là đơn giả lập/test
        await prisma.$executeRawUnsafe(
          `UPDATE StockItem SET orderId = NULL, isSold = 0 WHERE orderId = ?`,
          orderIdStr
        );
        // Xóa đơn hàng
        await prisma.$executeRawUnsafe(
          `DELETE FROM "Order" WHERE id = ?`,
          orderIdStr
        );
        return jsonResponse({ success: true, message: `Đã xóa đơn ${orderIdStr}` });
      }

      case "DELETE_ORDERS": {
        const { ids, onlyPending } = body;
        if (onlyPending) {
          await prisma.$executeRawUnsafe(
            `DELETE FROM "Order" WHERE status = 'PENDING'`
          );
          return jsonResponse({ success: true, message: "Đã dọn sạch toàn bộ đơn chờ thanh toán" });
        }
        if (Array.isArray(ids) && ids.length > 0) {
          for (const rawId of ids) {
            const singleId = String(rawId).trim();
            await prisma.$executeRawUnsafe(
              `UPDATE StockItem SET orderId = NULL, isSold = 0 WHERE orderId = ?`,
              singleId
            );
            await prisma.$executeRawUnsafe(
              `DELETE FROM "Order" WHERE id = ?`,
              singleId
            );
          }
          return jsonResponse({ success: true, message: `Đã xóa ${ids.length} đơn hàng` });
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
                `👉 Vui lòng liên hệ Admin <b>@zophim</b> (https://t.me/zophim) để nhận thưởng ngay!`;
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
        const supplierRes = await fetchSupplierProducts(maxPrice);
        if (!supplierRes.success) {
          return jsonResponse(
            { success: false, error: `Lỗi từ NCC LikeSub3s: ${supplierRes.error || "Không thể lấy danh sách sản phẩm"}` },
            400
          );
        }

        let addedCount = 0;
        let updatedCount = 0;

        for (const item of supplierRes.products) {
          const existing = await prisma.product.findFirst({
            where: {
              OR: [{ name: item.title }],
            },
          });

          if (existing) {
            await prisma.$executeRawUnsafe(
              `UPDATE "Product" SET supplierVariantId = ?, fulfillmentType = 'HYBRID'${
                item.thumbnail ? ", imageUrl = COALESCE(imageUrl, ?)" : ""
              } WHERE id = ?`,
              ...(item.thumbnail ? [item.variantId, item.thumbnail, existing.id] : [item.variantId, existing.id])
            );
            updatedCount++;
          } else {
            const created = await prisma.product.create({
              data: {
                name: item.title,
                price: item.price,
                description: item.description || null,
                category: item.category || "AI",
                isActive: true,
              },
            });
            await prisma.$executeRawUnsafe(
              `UPDATE "Product" SET supplierVariantId = ?, fulfillmentType = 'HYBRID', imageUrl = ? WHERE id = ?`,
              item.variantId,
              item.thumbnail || null,
              created.id
            );
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

      default:
        return NextResponse.json({ error: "Action không hợp lệ" }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
