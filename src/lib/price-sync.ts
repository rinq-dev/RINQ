/**
 * RINQ SHOP - Đồng bộ & Chốt giá tự động từ Nhà cung cấp (RoboticVN)
 */

import { prisma } from "./prisma";
import { getRoboticCatalog, roboticRetailPrice } from "./robotic";
import { broadcastPriceUpdate } from "./notifier";

export interface PriceChangeItem {
  productId: number;
  productName: string;
  oldSourcePrice: number | null;
  newSourcePrice: number;
  oldRetailPrice: number;
  newRetailPrice: number;
  marginPercent: number;
  diffPercent: number;
  isDiscount: boolean;
}

export interface SyncPricesResult {
  success: boolean;
  totalChecked: number;
  updatedCount: number;
  changes: PriceChangeItem[];
  error?: string;
}

/**
 * Gửi tin nhắn thông báo riêng cho Admin Telegram
 */
async function sendAdminTelegramAlert(message: string): Promise<boolean> {
  const botToken = process.env.BOT_TOKEN;
  const adminId = process.env.ADMIN_TELEGRAM_ID;
  if (!botToken || !adminId) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: adminId.trim(),
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error("Lỗi gửi thông báo Telegram cho Admin:", err);
    return false;
  }
}

/**
 * Quét toàn bộ sản phẩm RoboticVN, tự động chốt giá bán lẻ mới và gửi thông báo
 */
export async function syncRoboticPrices(options: {
  notifyAdmin?: boolean;
  broadcastCustomersOnDiscount?: boolean;
} = {}): Promise<SyncPricesResult> {
  const { notifyAdmin = true, broadcastCustomersOnDiscount = true } = options;

  try {
    const catalog = await getRoboticCatalog();
    if (!catalog?.products || catalog.products.length === 0) {
      return { success: true, totalChecked: 0, updatedCount: 0, changes: [] };
    }

    // Map sản phẩm RoboticVN theo key: "productId:variantId"
    const roboticMap = new Map(
      catalog.products.map((p) => [`${p.id}:${p.variantId}`, p])
    );

    // Lấy các sản phẩm trong database được liên kết với RoboticVN
    const localProducts = await prisma.product.findMany({
      where: {
        supplierVariantId: { startsWith: "ROBOTIC:" },
        autoPriceSync: true,
      },
      select: {
        id: true,
        name: true,
        price: true,
        lastSupplierPrice: true,
        retailMarginPercent: true,
        supplierVariantId: true,
        isActive: true,
      },
    });

    const changes: PriceChangeItem[] = [];

    for (const prod of localProducts) {
      if (!prod.supplierVariantId) continue;
      const sourceKey = prod.supplierVariantId.slice("ROBOTIC:".length);
      const remote = roboticMap.get(sourceKey);
      if (!remote) continue;

      const newSourcePrice = remote.sourcePrice;
      const oldSourcePrice = prod.lastSupplierPrice;
      const margin = prod.retailMarginPercent ?? 15;
      const newRetailPrice = roboticRetailPrice(newSourcePrice, margin);
      const oldRetailPrice = prod.price;

      // Kiểm tra xem giá nhà cung cấp hoặc giá bán lẻ có thay đổi không
      const hasSupplierPriceChange =
        oldSourcePrice === null || oldSourcePrice !== newSourcePrice;
      const hasRetailPriceChange = oldRetailPrice !== newRetailPrice;

      if (hasSupplierPriceChange || hasRetailPriceChange) {
        // Cập nhật giá mới vào database
        await prisma.product.update({
          where: { id: prod.id },
          data: {
            price: newRetailPrice,
            lastSupplierPrice: newSourcePrice,
          },
        });

        const diffSource = oldSourcePrice ? newSourcePrice - oldSourcePrice : 0;
        const diffPercent = oldSourcePrice
          ? Math.round((diffSource / oldSourcePrice) * 100)
          : 0;

        changes.push({
          productId: prod.id,
          productName: prod.name,
          oldSourcePrice,
          newSourcePrice,
          oldRetailPrice,
          newRetailPrice,
          marginPercent: margin,
          diffPercent,
          isDiscount: newRetailPrice < oldRetailPrice,
        });
      }
    }

    if (changes.length > 0) {
      // 1. Thông báo chi tiết cho Admin
      if (notifyAdmin) {
        let adminMsg =
          `⚡ <b>RINQ SHOP · TỰ ĐỘNG CHỐT GIÁ TỪ NHÀ CUNG CẤP</b> ⚡\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `Hệ thống vừa phát hiện và tự động chốt lại giá cho <b>${changes.length}</b> sản phẩm:\n\n`;

        changes.forEach((c, idx) => {
          const trendIcon = c.isDiscount ? "📉" : "📈";
          const diffText =
            c.diffPercent !== 0
              ? `(${c.diffPercent > 0 ? "+" : ""}${c.diffPercent}%)`
              : "";
          const oldSourceText = c.oldSourcePrice
            ? `${c.oldSourcePrice.toLocaleString("vi-VN")}đ`
            : "Chưa lưu";

          adminMsg +=
            `<b>${idx + 1}. ${c.productName}</b>\n` +
            `• Giá nhập gốc: ${oldSourceText} ➔ <b>${c.newSourcePrice.toLocaleString("vi-VN")}đ</b> ${diffText}\n` +
            `• Giá bán lẻ chốt: ${c.oldRetailPrice.toLocaleString("vi-VN")}đ ➔ <b>${c.newRetailPrice.toLocaleString("vi-VN")}đ</b> ${trendIcon}\n` +
            `• Biên lợi nhuận: <b>${c.marginPercent}%</b>\n\n`;
        });

        adminMsg += `<i>Đã tự động cập nhật vào kho và hiển thị trên Bot & Web.</i>`;
        await sendAdminTelegramAlert(adminMsg);
      }

      // 2. Tự động gửi broadcast cho khách hàng với các món HẠ GIÁ (ưu đãi)
      if (broadcastCustomersOnDiscount) {
        const discountedItems = changes.filter((c) => c.isDiscount);
        for (const item of discountedItems) {
          try {
            await broadcastPriceUpdate({
              productId: item.productId,
              productName: item.productName,
              oldPrice: item.oldRetailPrice,
              newPrice: item.newRetailPrice,
              priceReason: "Giá nhập từ nhà cung cấp giảm mạnh · Điều chỉnh ưu đãi cho khách hàng",
            });
          } catch (broadcastErr) {
            console.error("Lỗi broadcast giá giảm cho khách:", broadcastErr);
          }
        }
      }
    }

    return {
      success: true,
      totalChecked: localProducts.length,
      updatedCount: changes.length,
      changes,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Lỗi không xác định khi đồng bộ giá";
    console.error("Lỗi syncRoboticPrices:", errorMsg);
    return {
      success: false,
      totalChecked: 0,
      updatedCount: 0,
      changes: [],
      error: errorMsg,
    };
  }
}
