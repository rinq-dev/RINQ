import "dotenv/config";
import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";
import { Bot, Keyboard, InlineKeyboard, InputFile } from "grammy";
import { prisma } from "../lib/prisma";
import { addSubscriber } from "../lib/notifier";
import {
  getActiveGiveaways,
  joinGiveaway,
  validateCoupon,
  incrementCouponUsage,
} from "../lib/promo";
import { decryptStock, encryptStock } from "../lib/crypto";
import { verifyWebAuthSession } from "../lib/web-auth";
import { recordBotHeartbeat, stopBotHeartbeat } from "../lib/bot-status";
import { getCategoryIcon, getCategoryPriority } from "../lib/categories";
import { syncRoboticPrices, getSupplierStock } from "../lib/price-sync";
import {
  getActiveFlashSale,
  startFlashSale,
  stopFlashSale,
  calculateFlashSalePrice,
  formatRemainingTime,
} from "../lib/flash-sale";

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error("❌ LỖI: BOT_TOKEN chưa được cấu hình trong file .env");
  process.exit(1);
}

const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID || "8907169582";

const bot = new Bot(BOT_TOKEN);

// Cấu hình thông tin ngân hàng VietQR / SePay
// Helper: Chuẩn hóa mã ngân hàng sang định dạng chuẩn VietQR & SePay
function normalizeBankId(bank: string): string {
  const b = bank.trim().toUpperCase();
  if (b === "TP" || b === "TPB" || b === "TPBANK") return "TPBank";
  if (b === "VCB" || b === "VIETCOMBANK") return "Vietcombank";
  if (b === "TCB" || b === "TECHCOMBANK") return "Techcombank";
  if (b === "CTG" || b === "VTB" || b === "VIETINBANK") return "VietinBank";
  if (b === "BIDV") return "BIDV";
  if (b === "MBB" || b === "MBBANK" || b === "MB") return "MB";
  if (b === "ACB") return "ACB";
  if (b === "VPB" || b === "VPBANK") return "VPBank";
  if (b === "STB" || b === "SACOMBANK") return "Sacombank";
  if (b === "VIB") return "VIB";
  return bank.trim();
}

const RAW_BANK_ID = process.env.BANK_ID || "MB";
const BANK_ID = normalizeBankId(RAW_BANK_ID);
const BANK_ACCOUNT_NO = process.env.BANK_ACCOUNT_NO || "0123456789";
const BANK_ACCOUNT_NAME = process.env.BANK_ACCOUNT_NAME || "SHOP ADMIN";

// 1. Menu ReplyKeyboard cố định dưới đáy
const mainMenuKeyboard = new Keyboard()
  .text("🗂 Xem sản phẩm").text("📦 Đơn hàng của tôi").row()
  .text("💳 Ví & Số dư").text("🎁 Giveaway").row()
  .text("💬 Liên hệ hỗ trợ")
  .resized();

// Helper: Format tiền tệ VNĐ
function formatVND(amount: number): string {
  return amount.toLocaleString("vi-VN") + " đ";
}

// Helper: Tải ảnh mã QR (Ưu tiên SePay QR phản hồi tức thì, fallback VietQR)
async function fetchQRCodeBuffer(
  bankId: string,
  accNo: string,
  amount: number,
  memo: string,
  accName: string
): Promise<Buffer | null> {
  const normBank = normalizeBankId(bankId);
  const sepayUrl = `https://qr.sepay.vn/img?bank=${encodeURIComponent(
    normBank
  )}&acc=${encodeURIComponent(accNo)}&template=compact&amount=${amount}&des=${encodeURIComponent(
    memo
  )}`;
  try {
    const res = await fetch(sepayUrl, { signal: AbortSignal.timeout(3500) });
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("image")) {
      const ab = await res.arrayBuffer();
      return Buffer.from(ab);
    }
  } catch {}

  const vietQrUrl = `https://img.vietqr.io/image/${normBank}-${accNo}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(
    memo
  )}&accountName=${encodeURIComponent(accName)}`;
  try {
    const res = await fetch(vietQrUrl, { signal: AbortSignal.timeout(3500) });
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("image")) {
      const ab = await res.arrayBuffer();
      return Buffer.from(ab);
    }
  } catch {}

  return null;
}

async function generateOrderId(): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const orderId = `DH${randomBytes(16).toString("hex").toUpperCase()}`;
    const found = await prisma.order.findUnique({ where: { id: orderId } });
    if (!found) return orderId;
  }
  throw new Error("Không thể tạo mã đơn hàng duy nhất");
}

// Helper: Tính số lượng tồn kho khả dụng (bao gồm kết nối NCC API ẩn với khách & kiểm tra tồn kho NCC)
export function getProductStockCount(p: any): number {
  if (!p) return 0;
  const manualCount = Array.isArray(p.stocks) ? p.stocks.length : (p.stockAvailable ?? 0);
  const supplierVariantId = p.supplierVariantId;
  const fulfillmentType = p.fulfillmentType || "HYBRID";

  // Nếu là sản phẩm thuần thủ công hoặc chưa gắn mã NCC
  if (fulfillmentType === "MANUAL" || !supplierVariantId || !String(supplierVariantId).trim()) {
    return manualCount;
  }

  const sStock = getSupplierStock(supplierVariantId);

  // Nếu nhà cung cấp đã được quét và hết hàng (sStock === 0)
  if (sStock !== null && sStock <= 0) {
    return manualCount; // Chỉ cho phép mua nếu còn kho thủ công
  }

  const apiCount = sStock !== null ? Math.min(99, sStock) : 99;

  // Nếu là thuần API
  if (fulfillmentType === "API") {
    return apiCount;
  }

  // Chế độ HYBRID: Nếu còn kho thủ công thì tính theo kho thủ công, nếu hết kho thủ công thì lấy tồn kho API
  return manualCount > 0 ? manualCount : apiCount;
}

// Helper: Tải danh sách sản phẩm kèm cấu hình NCC từ SQLite
export async function fetchProductsWithSupplierMeta(whereClause: any = { isActive: true }): Promise<any[]> {
  const products = await prisma.product.findMany({
    where: whereClause,
    orderBy: { id: "asc" },
    include: {
      stocks: {
        where: { isSold: false },
        select: { id: true },
      },
    },
  });

  try {
    const rawList = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, priceNote, supplierVariantId, fulfillmentType, imageUrl, warranty FROM "Product"`
    );
    if (rawList && Array.isArray(rawList)) {
      const rawMap = new Map(rawList.map((r) => [Number(r.id), r]));
      return products.map((p) => {
        const extra = rawMap.get(p.id);
        return {
          ...p,
          priceNote: extra?.priceNote || (p as any).priceNote || null,
          imageUrl: extra?.imageUrl || (p as any).imageUrl || null,
          supplierVariantId: extra?.supplierVariantId || null,
          fulfillmentType: extra?.fulfillmentType || "HYBRID",
          warranty: extra?.warranty || p.warranty || null,
        };
      });
    }
  } catch (e) {
    console.warn("Lỗi đọc metadata sản phẩm:", e);
  }
  return products.map((p) => ({
    ...p,
    priceNote: (p as any).priceNote || null,
    imageUrl: (p as any).imageUrl || null,
    supplierVariantId: (p as any).supplierVariantId || null,
    fulfillmentType: (p as any).fulfillmentType || "HYBRID",
    warranty: p.warranty || null,
  }));
}

// Helper: Tải chi tiết 1 sản phẩm kèm cấu hình NCC từ SQLite
export async function fetchSingleProductWithSupplierMeta(id: number): Promise<any> {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      stocks: {
        where: { isSold: false },
      },
    },
  });
  if (!product) return null;

  try {
    const pRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT priceNote, supplierVariantId, fulfillmentType, imageUrl, warranty FROM "Product" WHERE id = ?`,
      id
    );
    if (pRows && pRows.length > 0) {
      const extra = pRows[0];
      return {
        ...product,
        priceNote: extra.priceNote || (product as any).priceNote || null,
        imageUrl: extra.imageUrl || (product as any).imageUrl || null,
        supplierVariantId: extra.supplierVariantId || null,
        fulfillmentType: extra.fulfillmentType || "HYBRID",
        warranty: extra.warranty || product.warranty || null,
      };
    }
  } catch {}
  return {
    ...product,
    priceNote: (product as any).priceNote || null,
    imageUrl: (product as any).imageUrl || null,
    supplierVariantId: (product as any).supplierVariantId || null,
    fulfillmentType: (product as any).fulfillmentType || "HYBRID",
    warranty: product.warranty || null,
  };
}

// Helper: Hiển thị danh sách các Danh Mục Sản Phẩm (Tier 1: Categories)
async function renderCatalog(ctx: any, deletePrevious = false) {
  if (deletePrevious) {
    await ctx.deleteMessage().catch(() => {});
  }

  const products = await fetchProductsWithSupplierMeta({ isActive: true });

  const totalProducts = products.length;
  if (totalProducts === 0) {
    const emptyText =
      `❖ <b>RINQ SHOP · DANH MỤC DỊCH VỤ CAO CẤP</b> ❖\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Kính chào Quý khách, hiện tại cửa hàng đang cập nhật thêm sản phẩm mới.\n` +
      `Kính mời Quý khách quay lại sau ít phút hoặc liên hệ Admin để được hỗ trợ!`;
    const emptyKeyboard = new InlineKeyboard()
      .text("🔄 Làm mới danh mục", "refresh_catalog")
      .row()
      .text("💬 Hỗ trợ trực tuyến (@zophim)", "inline_support");
    await ctx.reply(emptyText, { parse_mode: "HTML", reply_markup: emptyKeyboard });
    return;
  }

  // Nhóm sản phẩm theo danh mục (category)
  const categoriesMap = new Map<string, typeof products>();
  products.forEach((p) => {
    const cat = (p.category && p.category.trim()) || "Sản phẩm khác";
    if (!categoriesMap.has(cat)) {
      categoriesMap.set(cat, []);
    }
    categoriesMap.get(cat)!.push(p);
  });

  const inStockCount = products.filter((p) => getProductStockCount(p) > 0).length;
  const outOfStockCount = totalProducts - inStockCount;

  const inlineKeyboard = new InlineKeyboard();

  // Hiển thị danh sách từng Danh Mục có sắp xếp ưu tiên và gắn icon nhận diện
  const sortedCategories = Array.from(categoriesMap.entries()).sort(
    ([a], [b]) => getCategoryPriority(a) - getCategoryPriority(b)
  );

  sortedCategories.forEach(([catName, catProducts]) => {
    const icon = getCategoryIcon(catName);
    const totalStock = catProducts.reduce((sum: number, item: any) => sum + getProductStockCount(item), 0);
    const stockBadge = totalStock > 0 ? `🟢 Còn ${totalStock}` : "🔴 Tạm hết";
    inlineKeyboard
      .text(`${icon} ${catName} · ${catProducts.length} loại (${stockBadge})`, `cat:${catName}`)
      .row();
  });

  // Nút xem tất cả sản phẩm
  inlineKeyboard.text("🌐 Xem tất cả các gói sản phẩm", "cat:ALL").row();

  // 3 nút tiện ích nằm ngay cuối danh mục
  inlineKeyboard.text("🔄 Làm mới danh mục & tồn kho", "refresh_catalog").row();
  inlineKeyboard.text("📦 Lịch sử đơn hàng của tôi", "inline_my_orders").row();
  inlineKeyboard.text("💬 Hỗ trợ trực tuyến (@zophim)", "inline_support").row();

  const now = new Date();
  const timeStr = now.toLocaleTimeString("vi-VN", {
    hour12: false,
    timeZone: "Asia/Ho_Chi_Minh",
  });
  const dateStr = now.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });

  const flashSale = await getActiveFlashSale();
  const flashSaleBanner = flashSale
    ? `🔥 <b>${flashSale.title.toUpperCase()} · GIẢM NGAY ${flashSale.discountPercent}%</b> 🔥\n` +
      `⏱ <i>Ưu đãi kết thúc sau: ${formatRemainingTime(flashSale.expiresAt)}</i>` +
      (flashSale.note ? `\n💬 <i>"${flashSale.note}"</i>` : "") +
      `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`
    : "";

  const messageText =
    flashSaleBanner +
    `❖ <b>RINQ SHOP · DANH MỤC DỊCH VỤ CAO CẤP</b> ❖\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Hệ thống hiện cung cấp <b>${categoriesMap.size}</b> danh mục chính với <b>${totalProducts}</b> loại dịch vụ:\n` +
    `• Tình trạng: 🟢 <b>${inStockCount}</b> sẵn có  |  🔴 <b>${outOfStockCount}</b> tạm hết\n` +
    `• Trạng thái hệ thống: <b>Trực tuyến 24/7</b>\n\n` +
    `Kính mời Quý khách bấm chọn <b>Danh mục</b> bên dưới để xem chi tiết các loại gói dịch vụ:` +
    `\n\n<blockquote>⏱ <i>Thời gian đồng bộ: ${timeStr} · ${dateStr} (Giờ Việt Nam)</i></blockquote>`;

  if (!deletePrevious && ctx.callbackQuery?.message) {
    try {
      await ctx.editMessageText(messageText, {
        parse_mode: "HTML",
        reply_markup: inlineKeyboard,
      });
      return;
    } catch {
      // Nếu không sửa được thì gửi mới
    }
  }

  await ctx.reply(messageText, {
    parse_mode: "HTML",
    reply_markup: inlineKeyboard,
  });
}

// Helper: Hiển thị các loại sản phẩm bên trong một Danh Mục (Tier 2: Products in Category)
async function renderCategoryProducts(ctx: any, categoryName: string, deletePrevious = false) {
  if (deletePrevious) {
    await ctx.deleteMessage().catch(() => {});
  }

  const isAll = categoryName === "ALL";

  const products = await fetchProductsWithSupplierMeta({
    isActive: true,
    ...(isAll
      ? {}
      : categoryName === "Sản phẩm khác"
      ? { OR: [{ category: null }, { category: "" }, { category: "Sản phẩm khác" }] }
      : { category: categoryName }),
  });

  const inlineKeyboard = new InlineKeyboard();

  if (products.length === 0) {
    inlineKeyboard.text("🔙 Về danh mục chính", "menu_products").row();
    const emptyText =
      `📁 <b>DANH MỤC: ${isAll ? "TẤT CẢ SẢN PHẨM" : categoryName.toUpperCase()}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Hiện tại danh mục này chưa có loại sản phẩm nào khả dụng.\n` +
      `Kính mời Quý khách quay lại danh mục chính để tham khảo các dịch vụ khác!`;
    if (!deletePrevious && ctx.callbackQuery?.message) {
      try {
        await ctx.editMessageText(emptyText, { parse_mode: "HTML", reply_markup: inlineKeyboard });
        return;
      } catch {}
    }
    await ctx.reply(emptyText, { parse_mode: "HTML", reply_markup: inlineKeyboard });
    return;
  }

  const flashSale = await getActiveFlashSale();

  products.forEach((p) => {
    const count = getProductStockCount(p);
    const stockBadge =
      count > 0
        ? p.stocks.length > 0
          ? `🟢 Còn ${count}`
          : "🟢 Sẵn hàng"
        : "🔴 Hết hàng";
    const effectivePrice = flashSale
      ? calculateFlashSalePrice(p.price, flashSale.discountPercent)
      : p.price;
    const priceStr = flashSale
      ? `🔥 ${effectivePrice.toLocaleString("vi-VN")}đ`
      : `${p.price.toLocaleString("vi-VN")}đ`;
    const label = `🔹 ${p.name} · ${priceStr} · ${stockBadge}`;
    inlineKeyboard.text(label, `prod:${p.id}`).row();
  });

  inlineKeyboard.text("🔙 Quay lại danh mục chính", "menu_products").row();
  inlineKeyboard.text("🔄 Làm mới danh mục này", `cat:${categoryName}`).row();

  const catIcon = isAll ? "🌐" : getCategoryIcon(categoryName);
  const title = isAll ? "TẤT CẢ CÁC GÓI SẢN PHẨM" : `DANH MỤC · ${categoryName.toUpperCase()}`;
  const totalStock = products.reduce((acc, cur) => acc + getProductStockCount(cur), 0);

  const text =
    `${catIcon} <b>${title}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Hiện có <b>${products.length} loại gói</b> sẵn có (Tổng tồn kho: <b>${totalStock}</b> sản phẩm):\n` +
    `Kính mời Quý khách bấm vào gói cần mua bên dưới để xem chi tiết và tiến hành đặt hàng:`;

  if (!deletePrevious && ctx.callbackQuery?.message) {
    try {
      await ctx.editMessageText(text, {
        parse_mode: "HTML",
        reply_markup: inlineKeyboard,
      });
      return;
    } catch {}
  }

  await ctx.reply(text, {
    parse_mode: "HTML",
    reply_markup: inlineKeyboard,
  });
}

// 2. Command /start
bot.command("start", async (ctx) => {
  const match = ctx.match?.trim() || "";
  if (match.startsWith("login_")) {
    const token = match.replace(/^login_/, "").trim();
    if (ctx.from?.id && token) {
      const verified = await verifyWebAuthSession(token, {
        id: String(ctx.from.id),
        username: ctx.from.username,
        firstName: ctx.from.first_name,
      });

      if (verified) {
        await ctx.reply(
          `✅ <b>ĐĂNG NHẬP THÀNH CÔNG!</b>\n\n` +
          `Xin chào <b>${ctx.from.first_name}</b>, bạn đã liên kết tài khoản Telegram thành công cho phiên mua sắm trên Web.\n\n` +
          `👉 <b>Hãy quay lại trình duyệt</b>, trang web đã tự động nhận diện và sẵn sàng tiếp tục đơn hàng của bạn!`,
          { parse_mode: "HTML" }
        );
        return;
      } else {
        await ctx.reply(
          `⚠️ <b>Phiên đăng nhập không hợp lệ hoặc đã hết hạn!</b>\n\nVui lòng quay lại website bấm "Đăng nhập Telegram" để lấy mã mới.`,
          { parse_mode: "HTML" }
        );
        return;
      }
    }
  }

  if (ctx.from?.id) {
    addSubscriber(String(ctx.from.id), ctx.from.username, ctx.from.first_name).catch(() => {});
  }

  const customerName = ctx.from?.first_name ? `Quý khách <b>${ctx.from.first_name}</b>` : "<b>Quý khách</b>";
  const welcomeText =
    `✦ <b>RINQ SHOP · HỆ THỐNG PHÂN PHỐI TÀI NGUYÊN SỐ</b> ✦\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Kính chào ${customerName},\n\n` +
    `RINQ SHOP trân trọng đón tiếp Quý khách đến với dịch vụ cung cấp tài khoản, bản quyền và tài nguyên số cao cấp tự động 24/7.\n\n` +
    `💎 <b>Đặc quyền dịch vụ tại RINQ SHOP:</b>\n` +
    `• <b>Thanh toán tức thì:</b> Giao dịch trực tiếp qua VietQR SePay, không giam vốn giữ ví.\n` +
    `• <b>Giao hàng siêu tốc:</b> Trả tài nguyên tự động sau 3 - 5 giây xác nhận.\n` +
    `• <b>Chính sách bảo hành:</b> Cam kết hỗ trợ 1:1 tận tâm và minh bạch.\n\n` +
    `Xin kính mời Quý khách tham khảo danh mục sản phẩm bên dưới 👇`;

  const logoPath = path.join(process.cwd(), "public", "logo.jpg");
  if (fs.existsSync(logoPath)) {
    try {
      await ctx.replyWithPhoto(new InputFile(logoPath), {
        caption: welcomeText,
        parse_mode: "HTML",
        reply_markup: mainMenuKeyboard,
      });
      await renderCatalog(ctx);
      return;
    } catch (e) {
      console.error("Lỗi gửi ảnh logo start:", e);
    }
  }

  await ctx.reply(welcomeText, {
    parse_mode: "HTML",
    reply_markup: mainMenuKeyboard,
  });

  await renderCatalog(ctx);
});

// 3. Xử lý menu bàn phím cố định dưới đáy & các Slash Commands
async function handleShowGiveaways(ctx: any) {
  const gas = await getActiveGiveaways();
  if (gas.length === 0) {
    await ctx.reply(
      `🎁 <b>CHƯƠNG TRÌNH TRI ÂN · RINQ SHOP</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Kính chào Quý khách, hiện tại chưa có sự kiện Giveaway nào đang mở.\n` +
      `Kính mời Quý khách theo dõi các thông báo tiếp theo từ shop để không bỏ lỡ phần quà tri ân hấp dẫn!`,
      { parse_mode: "HTML" }
    );
    return;
  }

  for (const ga of gas) {
    const text =
      `🎁 <b>SỰ KIỆN TRI ÂN · ${ga.title.toUpperCase()}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🏆 <b>Phần thưởng cao cấp:</b> <b>${ga.reward}</b>\n` +
      `👥 <b>Số lượng thành viên tham gia:</b> <b>${ga.participantCount}</b> người\n` +
      (ga.description ? `📝 <b>Chi tiết sự kiện:</b>\n${ga.description}\n\n` : `\n`) +
      `Kính mời Quý khách bấm nút <b>🎉 Tham gia ngay</b> bên dưới để có cơ hội nhận quà miễn phí:`;

    const keyboard = new InlineKeyboard().text("🎉 Tham gia ngay", `join_ga:${ga.id}`);
    await ctx.reply(text, { parse_mode: "HTML", reply_markup: keyboard });
  }
}

async function handleShowGuide(ctx: any) {
  const guideText =
    `❖ <b>QUY TRÌNH GIAO DỊCH TỰ ĐỘNG · RINQ SHOP</b> ❖\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Kính gửi Quý khách, RINQ SHOP vận hành hệ thống thanh toán trực tiếp tối giản, không cần nạp tiền giữ ví:\n\n` +
    `<b>BƯỚC 1: LỰA CHỌN SẢN PHẨM</b>\n` +
    `• Chọn mục <b>🗂 Xem sản phẩm</b> trên menu hoặc gõ lệnh <code>/menu</code>.\n` +
    `• Bấm vào sản phẩm Quý khách quan tâm để xem thông tin chi tiết và đơn giá.\n\n` +
    `<b>BƯỚC 2: TIẾN HÀNH ĐẶT HÀNG</b>\n` +
    `• Bấm <b>💳 Mua ngay</b> (hoặc chọn <b>🏷 Dùng mã giảm giá</b> nếu có mã ưu đãi).\n` +
    `• Chọn số lượng cần mua phù hợp với nhu cầu.\n\n` +
    `<b>BƯỚC 3: QUÉT MÃ VIETQR THANH TOÁN</b>\n` +
    `• Mở ứng dụng ngân hàng và quét mã QR do Bot tạo riêng cho đơn hàng.\n` +
    `• <i>Lưu ý quan trọng:</i> Giữ <b>NGUYÊN</b> mã đơn hàng trong nội dung chuyển khoản để hệ thống tự động nhận diện.\n\n` +
    `<b>BƯỚC 4: NHẬN TÀI NGUYÊN TỨC THÌ</b>\n` +
    `• Sau 3 - 5 giây hệ thống nhận tiền, Bot sẽ tự động gửi tài khoản/key ngay tại khung chat này kèm hóa đơn giao dịch.\n\n` +
    `<blockquote>💬 <i>Cần hỗ trợ trong quá trình giao dịch, Quý khách vui lòng bấm <b>💬 Liên hệ hỗ trợ</b> để gặp Admin.</i></blockquote>`;

  await ctx.reply(guideText, { parse_mode: "HTML" });
}

async function handleShowSupport(ctx: any) {
  const keyboard = new InlineKeyboard()
    .url("💬 Trò chuyện cùng Admin @zophim", "https://t.me/zophim")
    .row()
    .text("🔙 Về danh mục sản phẩm", "menu_products");

  await ctx.reply(
    `💬 <b>TRUNG TÂM CHĂM SÓC KHÁCH HÀNG · RINQ SHOP</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Kính chào Quý khách, đội ngũ RINQ SHOP luôn sẵn sàng lắng nghe và giải đáp mọi yêu cầu của Quý khách:\n\n` +
    `• <b>Admin phụ trách:</b> <b>@zophim</b>\n` +
    `• <b>Thời gian phản hồi:</b> Thường trực 24/7\n` +
    `• <b>Phạm vi hỗ trợ:</b> Tư vấn sản phẩm, bảo hành tài khoản, xử lý đơn hàng và nạp tài nguyên.\n\n` +
    `Kính mời Quý khách bấm nút <b>💬 Trò chuyện cùng Admin</b> bên dưới để kết nối trực tiếp:`,
    { parse_mode: "HTML", reply_markup: keyboard }
  );
}

bot.hears("🗂 Xem sản phẩm", async (ctx) => renderCatalog(ctx));
bot.command(["menu", "shop"], async (ctx) => renderCatalog(ctx));

bot.hears("📦 Đơn hàng của tôi", async (ctx) => showUserOrders(ctx));
bot.command(["orders", "myorders"], async (ctx) => showUserOrders(ctx));

bot.hears("🎁 Giveaway", handleShowGiveaways);
bot.command("giveaway", handleShowGiveaways);

bot.hears(["❓ Hướng dẫn mua", "❓ Cách mua"], handleShowGuide);
bot.command(["help", "huongdan"], handleShowGuide);

bot.hears(["💬 Liên hệ hỗ trợ", "🎧 Liên hệ hỗ trợ"], handleShowSupport);
bot.command(["support", "admin"], handleShowSupport);

// Helper hiển thị lịch sử đơn hàng
async function showUserOrders(ctx: any, deletePrevious = false) {
  if (deletePrevious) {
    await ctx.deleteMessage().catch(() => {});
  }

  const telegramId = String(ctx.from?.id);
  const paidOrders = await prisma.order.findMany({
    where: {
      telegramId,
      status: "PAID",
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      product: true,
      stocks: true,
    },
  });

  const keyboard = new InlineKeyboard().text("🔙 Quay lại danh mục", "menu_products");

  if (paidOrders.length === 0) {
    await ctx.reply(
      `📦 <b>LỊCH SỬ GIAO DỊCH · RINQ SHOP</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Kính chào Quý khách, hiện tại tài khoản chưa ghi nhận đơn hàng hoàn tất nào.\n` +
      `Kính mời Quý khách tham khảo các dịch vụ cao cấp tại mục <b>🗂 Xem sản phẩm</b> bên dưới:`,
      { parse_mode: "HTML", reply_markup: keyboard }
    );
    return;
  }

  let text = `📦 <b>10 ĐƠN HÀNG GẦN NHẤT CỦA QUÝ KHÁCH:</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  paidOrders.forEach((o, idx) => {
    const time = o.paidAt || o.createdAt;
    const timeStr = new Date(time).toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
    });
    text += `<b>${idx + 1}. Đơn #${o.id}</b> · ${o.product.name}\n`;
    text += `💰 Giá trị: <b>${formatVND(o.totalAmount)}</b> | Ngày: ${timeStr}\n`;
    if (o.stocks && o.stocks.length > 0) {
      o.stocks.forEach((stock) => {
        text += `🔑 Dữ liệu: <code>${decryptStock(stock.data)}</code>\n`;
      });
    } else {
      text += `🔑 Dữ liệu: <i>(Đã bàn giao)</i>\n`;
    }
    text += `---------------------------\n`;
  });

  text += `\n<blockquote>💡 <i>Chạm vào mã key/tài khoản để sao chép nhanh!</i></blockquote>`;

  await ctx.reply(text, { parse_mode: "HTML", reply_markup: keyboard });
}

// 4. Callback Query: Xem chi tiết sản phẩm `prod:<id>` (XÓA TIN NHẮN CŨ ĐỂ THAY THẾ)
bot.callbackQuery(/^prod:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  const productId = parseInt(ctx.match[1], 10);

  const product = await fetchSingleProductWithSupplierMeta(productId);

  if (!product) {
    await ctx.reply("❌ Sản phẩm không tồn tại hoặc đã bị gỡ!");
    return;
  }

  const stockCount = getProductStockCount(product);
  const desc = product.description || "Không có mô tả thêm.";
  const priceNoteText = (product as any).priceNote
    ? `<blockquote>📝 <b>Ghi chú:</b>\n${(product as any).priceNote}</blockquote>\n\n`
    : "";
  let warrantyText = "";
  if (product.warranty?.trim()) {
    const rawWarranty = product.warranty.trim();
    const hasHeader = /chính sách bảo hành/i.test(rawWarranty.split("\n")[0] || "");
    warrantyText = `<blockquote>${hasHeader ? "" : "🛡️ <b>CHÍNH SÁCH BẢO HÀNH:</b>\n"}${rawWarranty}</blockquote>\n\n`;
  }

  // Xóa tin nhắn danh mục cũ để thay thế bằng giao diện chi tiết sản phẩm
  await ctx.deleteMessage().catch(() => {});

  const stockStatusStr =
    stockCount > 0
      ? product.stocks.length > 0
        ? `🟢 Sẵn có <b>${product.stocks.length}</b> sản phẩm`
        : `🟢 Sẵn hàng (Giao tức thì 24/7)`
      : "🔴 Tạm hết hàng";

  const flashSale = await getActiveFlashSale();
  const effectivePrice = flashSale
    ? calculateFlashSalePrice(product.price, flashSale.discountPercent)
    : product.price;

  const priceLine = flashSale
    ? `• <b>Đơn giá:</b> <s>${formatVND(product.price)}</s> ➔ <b>${formatVND(effectivePrice)}</b> 🔥 <i>(-${flashSale.discountPercent}% Flash Sale)</i>\n`
    : `• <b>Đơn giá:</b> <b>${formatVND(product.price)}</b> / sản phẩm\n`;

  const text =
    `❖ <b>${product.name.toUpperCase()}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    priceLine +
    `• <b>Tình trạng:</b> ${stockStatusStr}\n` +
    `• <b>Hình thức giao dịch:</b> Giao tài nguyên tự động tức thì 24/7\n\n` +
    priceNoteText +
    `📝 <b>Thông tin & Mô tả chi tiết:</b>\n${desc}\n\n` +
    warrantyText +
    (stockCount > 0
      ? `Kính mời Quý khách lựa chọn nút bên dưới để tiến hành thanh toán:`
      : `<blockquote>⚠️ <i>Sản phẩm hiện đang tạm hết hàng. Quý khách vui lòng theo dõi thông báo hoặc liên hệ Admin để đặt trước.</i></blockquote>`);

  const keyboard = new InlineKeyboard();
  if (stockCount > 0) {
    keyboard.text("💳 Mua ngay", `buy:${product.id}`).row();
    keyboard.text("🏷 Dùng mã giảm giá", `coupon_info:${product.id}`).row();
  }
  if (product.category && product.category.trim()) {
    keyboard.text(`🔙 Quay lại danh mục ${product.category}`, `cat:${product.category}`).row();
  }
  keyboard.text("📁 Về tất cả danh mục", "menu_products");

  if (product.imageUrl && product.imageUrl.trim()) {
    try {
      await ctx.replyWithPhoto(product.imageUrl.trim(), {
        caption: text,
        parse_mode: "HTML",
        reply_markup: keyboard,
      });
      return;
    } catch (photoErr) {
      console.warn("Lỗi gửi ảnh sản phẩm, chuyển sang tin nhắn văn bản:", photoErr);
    }
  }

  await ctx.reply(text, {
    parse_mode: "HTML",
    reply_markup: keyboard,
  });
});

// Callback Query: Xem các loại sản phẩm theo danh mục `cat:<name>`
bot.callbackQuery(/^cat:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  const catName = ctx.match[1];
  await renderCategoryProducts(ctx, catName, false);
});

// 5. Callback Query: Mua ngay `buy:<id>` (XÓA CHI TIẾT ĐỂ THAY THẾ BẰNG MÃ QR)
bot.callbackQuery(/^buy:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  const productId = parseInt(ctx.match[1], 10);

  const product = await fetchSingleProductWithSupplierMeta(productId);
  const stockCount = getProductStockCount(product);

  if (!product || stockCount === 0) {
    await ctx.reply("❌ Rất tiếc, sản phẩm này vừa hết hàng! Vui lòng chọn sản phẩm khác.");
    return;
  }

  const orderId = await generateOrderId();
  const telegramId = String(ctx.from?.id);
  const username = ctx.from?.username || null;

  const flashSale = await getActiveFlashSale();
  const finalPrice = flashSale
    ? calculateFlashSalePrice(product.price, flashSale.discountPercent)
    : product.price;

  // Tạo đơn hàng ở trạng thái PENDING
  await prisma.order.create({
    data: {
      id: orderId,
      telegramId,
      username,
      productId: product.id,
      totalAmount: finalPrice,
      status: "PENDING",
    },
  });
  await prisma.$executeRawUnsafe(
    `UPDATE "Order" SET quantity = 1 WHERE id = ?`,
    orderId
  );

  // Tải ảnh mã QR qua buffer
  const qrBuffer = await fetchQRCodeBuffer(
    BANK_ID,
    BANK_ACCOUNT_NO,
    finalPrice,
    orderId,
    BANK_ACCOUNT_NAME
  );

  const discountNote = flashSale
    ? `• <b>Ưu đãi Flash Sale:</b> Giảm -${flashSale.discountPercent}%\n`
    : "";

  const paymentText =
    `🧾 <b>HÓA ĐƠN ĐẶT HÀNG:</b> <code>${orderId}</code>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `• <b>Sản phẩm:</b> <b>${product.name}</b>\n` +
    `• <b>Số lượng:</b> <b>1 sản phẩm</b>\n` +
    discountNote +
    `• <b>Tổng thanh toán:</b> <b>${formatVND(finalPrice)}</b>\n\n` +
    `🏦 <b>THÔNG TIN CHUYỂN KHOẢN TỰ ĐỘNG:</b>\n` +
    `• Ngân hàng: <b>${BANK_ID}</b>\n` +
    `• Số tài khoản: <code>${BANK_ACCOUNT_NO}</code>\n` +
    `• Chủ tài khoản: <b>${BANK_ACCOUNT_NAME}</b>\n` +
    `• Số tiền: <code>${product.price}</code>\n` +
    `• Nội dung chuyển khoản: <code>${orderId}</code>\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📌 <b>HƯỚNG DẪN THANH TOÁN:</b>\n` +
    `1. Quý khách quét mã <b>VietQR</b> phía trên hoặc chuyển khoản theo thông tin trên (chạm vào dòng STK hoặc Nội dung để tự động sao chép).\n` +
    `2. Xin vui lòng giữ <b>NGUYÊN</b> nội dung chuyển khoản là <code>${orderId}</code> để hệ thống tự động nhận diện.\n` +
    `3. Bot sẽ tự động gửi tài khoản/key ngay tại đây sau 3 - 5 giây xác nhận!\n\n` +
    `<i>Xin trân trọng cảm ơn Quý khách đã lựa chọn RINQ SHOP!</i>`;

  const userRec = await prisma.telegramUser.findUnique({ where: { id: telegramId } }).catch(() => null);
  const userBalance = userRec?.balance || 0;

  const keyboard = new InlineKeyboard();
  if (userBalance >= product.price) {
    keyboard.text(`💳 Thanh toán bằng Số Dư Ví (${userBalance.toLocaleString("vi-VN")}đ)`, `pay_balance:${orderId}`).row();
  }
  keyboard.text("🔙 Hủy / Về danh mục", "menu_products");

  // Xóa tin nhắn chi tiết trước đó để thay thế bằng giao diện thanh toán
  await ctx.deleteMessage().catch(() => {});

  let sentQrMsg: any = null;
  if (qrBuffer) {
    try {
      sentQrMsg = await ctx.replyWithPhoto(new InputFile(qrBuffer, `vietqr_${orderId}.png`), {
        caption: paymentText,
        parse_mode: "HTML",
        reply_markup: keyboard,
      });
    } catch (photoErr) {
      console.error("Lỗi replyWithPhoto:", photoErr);
    }
  }

  if (!sentQrMsg) {
    sentQrMsg = await ctx.reply(paymentText, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  }

  if (sentQrMsg?.message_id) {
    await prisma.$executeRawUnsafe(
      `UPDATE "Order" SET qrMessageId = ? WHERE id = ?`,
      sentQrMsg.message_id,
      orderId
    );
  }
});

// 6. Callback Query: Trở về danh mục (XÓA TIN HIỆN TẠI VÀ MỞ LẠI DANH MỤC)
bot.callbackQuery("menu_products", async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  await renderCatalog(ctx, true);
});

// 7. Callback Query: Làm mới danh sách & tồn kho
bot.callbackQuery("refresh_catalog", async (ctx) => {
  await ctx.answerCallbackQuery({ text: "🔄 Đã làm mới danh mục!" }).catch(() => {});
  await renderCatalog(ctx, false);
});

// 8. Callback Query: Đơn hàng của tôi (từ inline button)
bot.callbackQuery("inline_my_orders", async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  await showUserOrders(ctx, true);
});

// 9. Callback Query: Hỗ trợ trỏ tới @zophim
bot.callbackQuery("inline_support", async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  await ctx.deleteMessage().catch(() => {});
  const keyboard = new InlineKeyboard()
    .url("💬 Trò chuyện cùng Admin @zophim", "https://t.me/zophim")
    .row()
    .text("🔙 Về danh mục sản phẩm", "menu_products");

  await ctx.reply(
    `💬 <b>TRUNG TÂM CHĂM SÓC KHÁCH HÀNG · RINQ SHOP</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Kính chào Quý khách, đội ngũ RINQ SHOP luôn thường trực tiếp nhận và hỗ trợ Quý khách 24/7:\n\n` +
    `• <b>Admin hỗ trợ:</b> <b>@zophim</b>\n` +
    `• <b>Đường dẫn kết nối:</b> https://t.me/zophim\n` +
    `• <b>Nội dung tiếp nhận:</b> Tư vấn tài nguyên, bảo hành tài khoản, đối soát giao dịch.\n\n` +
    `Kính mời Quý khách bấm vào nút <b>💬 Trò chuyện cùng Admin</b> bên dưới:`,
    { parse_mode: "HTML", reply_markup: keyboard }
  );
});

// 10. Callback Query: Tham gia Giveaway
bot.callbackQuery(/^join_ga:(\d+)$/, async (ctx) => {
  const gaId = parseInt(ctx.match[1], 10);
  const result = await joinGiveaway(
    gaId,
    String(ctx.from?.id),
    ctx.from?.username,
    ctx.from?.first_name
  );
  if (result.alreadyJoined) {
    await ctx.answerCallbackQuery({
      text: "⚠️ Quý khách đã tham gia sự kiện này rồi!",
      show_alert: true,
    });
  } else if (result.success) {
    await ctx.answerCallbackQuery({
      text: "🎉 Quý khách đã ghi danh thành công Giveaway! Chúc Quý khách may mắn!",
      show_alert: true,
    });
  } else {
    await ctx.answerCallbackQuery({
      text: result.message || "Lỗi tham gia",
      show_alert: true,
    });
  }
});

// Interface theo dõi trạng thái mua hàng của user (chờ nhập mã coupon)
interface UserCheckoutState {
  action: "WAIT_COUPON";
  productId: number;
  quantity: number;
  timestamp: number;
}
const checkoutStates = new Map<string, UserCheckoutState>();

// 11. Callback Query: Chọn số lượng trước khi nhập mã giảm giá
bot.callbackQuery(/^coupon_info:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  const productId = parseInt(ctx.match[1], 10);
  const product = await fetchSingleProductWithSupplierMeta(productId);
  if (!product) {
    await ctx.reply("❌ Rất tiếc, sản phẩm không tồn tại hoặc đã ngừng cung cấp!");
    return;
  }

  const stockCount = getProductStockCount(product);
  if (stockCount === 0) {
    await ctx.answerCallbackQuery({
      text: "⚠️ Sản phẩm này hiện đã hết hàng trong kho!",
      show_alert: true,
    }).catch(() => {});
    return;
  }

  // Xóa tin nhắn chi tiết cũ để hiển thị giao diện chọn số lượng
  await ctx.deleteMessage().catch(() => {});

  const text =
    `🏷 <b>ÁP DỤNG MÃ ƯU ĐÃI · BƯỚC 1</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `• <b>Sản phẩm:</b> <b>${product.name}</b>\n` +
    `• <b>Đơn giá gốc:</b> <b>${formatVND(product.price)}</b> / sản phẩm\n` +
    `• <b>Tồn kho sẵn có:</b> <b>${stockCount} sản phẩm</b>\n\n` +
    `🔢 <b>Kính mời Quý khách lựa chọn số lượng muốn mua:</b>`;

  const keyboard = new InlineKeyboard();
  const quantities: number[] = [];

  if (stockCount <= 6) {
    for (let i = 1; i <= stockCount; i++) quantities.push(i);
  } else {
    quantities.push(1, 2, 3, 5);
    if (stockCount >= 10) quantities.push(10);
    if (!quantities.includes(stockCount)) quantities.push(stockCount);
  }

  // Chia thành các hàng 3 nút
  for (let i = 0; i < quantities.length; i += 3) {
    const chunk = quantities.slice(i, i + 3);
    for (const q of chunk) {
      const label = q === stockCount && q > 5 ? `Tất cả (${q})` : `${q} sản phẩm`;
      keyboard.text(label, `qty_coupon:${product.id}:${q}`);
    }
    keyboard.row();
  }

  keyboard.text("🔙 Quay lại sản phẩm", `prod:${product.id}`);

  await ctx.reply(text, { parse_mode: "HTML", reply_markup: keyboard });
});

// 12. Callback Query: Đã chọn số lượng -> Yêu cầu nhập mã giảm giá
bot.callbackQuery(/^qty_coupon:(\d+):(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  const productId = parseInt(ctx.match[1], 10);
  const quantity = parseInt(ctx.match[2], 10);
  const telegramId = String(ctx.from?.id);

  const product = await fetchSingleProductWithSupplierMeta(productId);
  const stockCount = getProductStockCount(product);

  if (!product || stockCount < quantity) {
    await ctx.answerCallbackQuery({
      text: "⚠️ Số lượng trong kho không đủ đáp ứng!",
      show_alert: true,
    }).catch(() => {});
    return;
  }

  // Lưu trạng thái đang đợi nhập mã giảm giá
  checkoutStates.set(telegramId, {
    action: "WAIT_COUPON",
    productId,
    quantity,
    timestamp: Date.now(),
  });

  await ctx.deleteMessage().catch(() => {});

  const totalBase = product.price * quantity;
  const text =
    `🏷 <b>ÁP DỤNG MÃ ƯU ĐÃI · BƯỚC 2</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `• <b>Sản phẩm:</b> <b>${product.name}</b>\n` +
    `• <b>Số lượng:</b> <b>${quantity} sản phẩm</b>\n` +
    `• <b>Tạm tính ban đầu:</b> <s>${formatVND(totalBase)}</s>\n\n` +
    `💬 <b>Kính mời Quý khách gửi mã giảm giá vào khung chat:</b>\n` +
    `<i>(Ví dụ: Gõ mã <code>RINQ10</code> và gửi tin nhắn)</i>\n\n` +
    `👉 Nếu chưa có mã ưu đãi, Quý khách vui lòng bấm <b>"⏩ Bỏ qua mã & Mua ngay"</b> bên dưới:`;

  const keyboard = new InlineKeyboard()
    .text("⏩ Bỏ qua mã & Mua ngay", `skip_coupon:${productId}:${quantity}`)
    .row()
    .text("🔙 Chọn lại số lượng", `coupon_info:${productId}`)
    .row()
    .text("❌ Hủy giao dịch", "menu_products");

  await ctx.reply(text, { parse_mode: "HTML", reply_markup: keyboard });
});

// 13. Callback Query: Bỏ qua mã giảm giá -> Mua giá gốc theo số lượng đã chọn
bot.callbackQuery(/^skip_coupon:(\d+):(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  const productId = parseInt(ctx.match[1], 10);
  const quantity = parseInt(ctx.match[2], 10);
  const telegramId = String(ctx.from?.id);
  checkoutStates.delete(telegramId);

  const product = await fetchSingleProductWithSupplierMeta(productId);
  const stockCount = getProductStockCount(product);

  if (!product || stockCount < quantity) {
    await ctx.reply("❌ Rất tiếc, sản phẩm này hiện không còn đủ số lượng trong kho!");
    return;
  }

  const orderId = await generateOrderId();
  const username = ctx.from?.username || null;
  const totalAmount = product.price * quantity;

  await prisma.order.create({
    data: {
      id: orderId,
      telegramId,
      username,
      productId: product.id,
      totalAmount,
      status: "PENDING",
    },
  });
  await prisma.$executeRawUnsafe(
    `UPDATE "Order" SET quantity = ? WHERE id = ?`,
    quantity,
    orderId
  );

  const qrBuffer = await fetchQRCodeBuffer(
    BANK_ID,
    BANK_ACCOUNT_NO,
    totalAmount,
    orderId,
    BANK_ACCOUNT_NAME
  );

  const paymentText =
    `🧾 <b>HÓA ĐƠN ĐẶT HÀNG:</b> <code>${orderId}</code>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `• <b>Sản phẩm:</b> <b>${product.name}</b>\n` +
    `• <b>Số lượng:</b> <b>${quantity} sản phẩm</b>\n` +
    `• <b>Tổng thanh toán:</b> <b>${formatVND(totalAmount)}</b>\n\n` +
    `🏦 <b>THÔNG TIN CHUYỂN KHOẢN TỰ ĐỘNG:</b>\n` +
    `• Ngân hàng: <b>${BANK_ID}</b>\n` +
    `• Số tài khoản: <code>${BANK_ACCOUNT_NO}</code>\n` +
    `• Chủ tài khoản: <b>${BANK_ACCOUNT_NAME}</b>\n` +
    `• Số tiền: <code>${totalAmount}</code>\n` +
    `• Nội dung chuyển khoản: <code>${orderId}</code>\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📌 <b>HƯỚNG DẪN THANH TOÁN:</b>\n` +
    `1. Quý khách quét mã <b>VietQR</b> phía trên hoặc chuyển khoản theo thông tin trên (chạm vào dòng STK hoặc Nội dung để tự động sao chép).\n` +
    `2. Xin vui lòng giữ <b>NGUYÊN</b> nội dung chuyển khoản là <code>${orderId}</code> để hệ thống tự động đối soát.\n` +
    `3. Bot sẽ tự động trả đủ <b>${quantity} tài khoản/key</b> ngay sau 3 - 5 giây!\n\n` +
    `<i>Xin trân trọng cảm ơn Quý khách!</i>`;

  const userRec = await prisma.telegramUser.findUnique({ where: { id: telegramId } }).catch(() => null);
  const userBalance = userRec?.balance || 0;

  const keyboard = new InlineKeyboard();
  if (userBalance >= totalAmount) {
    keyboard.text(`💳 Thanh toán bằng Số Dư Ví (${userBalance.toLocaleString("vi-VN")}đ)`, `pay_balance:${orderId}`).row();
  }
  keyboard.text("🔙 Hủy / Về danh mục", "menu_products");

  await ctx.deleteMessage().catch(() => {});

  let sentQrMsg: any = null;
  if (qrBuffer) {
    try {
      sentQrMsg = await ctx.replyWithPhoto(new InputFile(qrBuffer, `vietqr_${orderId}.png`), {
        caption: paymentText,
        parse_mode: "HTML",
        reply_markup: keyboard,
      });
    } catch (photoErr) {
      console.error("Lỗi replyWithPhoto:", photoErr);
    }
  }

  if (!sentQrMsg) {
    sentQrMsg = await ctx.reply(paymentText, { parse_mode: "HTML", reply_markup: keyboard });
  }

  if (sentQrMsg?.message_id) {
    await prisma.$executeRawUnsafe(
      `UPDATE "Order" SET qrMessageId = ? WHERE id = ?`,
      sentQrMsg.message_id,
      orderId
    );
  }
});

const pendingDepositUsers = new Set<string>();
const adminFlashSaleDrafts = new Map<string, { discountPercent: number; hours: number; title: string }>();
const adminWaitingFlashSaleNote = new Set<string>();

// 14. Lắng nghe tin nhắn văn bản từ người dùng (nhập mã giảm giá hoặc số tiền nạp ví)
bot.on("message:text", async (ctx, next) => {
  const telegramId = String(ctx.from?.id);
  const state = checkoutStates.get(telegramId);
  const text = ctx.message.text.trim();

  // Bỏ qua nếu là lệnh bot hoặc bấm các nút menu cố định dưới đáy
  if (
    text.startsWith("/") ||
    [
      "🗂 Xem sản phẩm",
      "📦 Đơn hàng của tôi",
      "💳 Ví & Số dư",
      "🎁 Giveaway",
      "❓ Hướng dẫn mua",
      "❓ Cách mua",
      "💬 Liên hệ hỗ trợ",
      "🎧 Liên hệ hỗ trợ",
    ].includes(text)
  ) {
    checkoutStates.delete(telegramId);
    pendingDepositUsers.delete(telegramId);
    adminWaitingFlashSaleNote.delete(telegramId);
    return next();
  }

  // Nếu Admin đang trong phiên nhập ghi chú cho Flash Sale
  if (adminWaitingFlashSaleNote.has(telegramId)) {
    adminWaitingFlashSaleNote.delete(telegramId);
    const draft = adminFlashSaleDrafts.get(telegramId);
    adminFlashSaleDrafts.delete(telegramId);

    if (text.toLowerCase() === "huy" || text.toLowerCase() === "hủy") {
      await ctx.reply("Đã hủy cấu hình Flash Sale.");
      return;
    }

    if (!draft) {
      await ctx.reply("Phiên cấu hình Flash Sale đã hết hạn. Vui lòng gõ lại lệnh.");
      return;
    }

    const finalNote = (text.toLowerCase() === "bo qua" || text.toLowerCase() === "bỏ qua") ? null : text;
    await launchFlashSaleAndNotify(ctx, draft.discountPercent, draft.hours, draft.title, finalNote);
    return;
  }

  // Nếu người dùng đang chờ nhập số tiền nạp ví
  if (pendingDepositUsers.has(telegramId)) {
    if (text.toLowerCase() === "huy" || text.toLowerCase() === "hủy" || text === "0") {
      pendingDepositUsers.delete(telegramId);
      await ctx.reply("Đã hủy nạp tiền ví.");
      return;
    }
    const amount = parseMoneyInput(text);
    if (!amount || isNaN(amount) || amount < 10000) {
      await ctx.reply(
        "⚠️ Số tiền không hợp lệ. Số tiền nạp tối thiểu là <b>10.000 đ</b> (ví dụ: <code>50k</code> hoặc <code>50000</code>). Gửi <code>huy</code> để hủy.",
        { parse_mode: "HTML" }
      );
      return;
    }
    pendingDepositUsers.delete(telegramId);
    await handleDepositRequest(ctx, amount);
    return;
  }

  // Nếu người dùng đang trong phiên chờ nhập mã giảm giá
  if (state && state.action === "WAIT_COUPON") {
    const product = await fetchSingleProductWithSupplierMeta(state.productId);
    const stockCount = getProductStockCount(product);

    if (!product || stockCount < state.quantity) {
      checkoutStates.delete(telegramId);
      await ctx.reply(
        "❌ Rất tiếc, sản phẩm này hiện không còn đủ số lượng trong kho! Kính mời Quý khách chọn sản phẩm khác hoặc giảm số lượng.",
        { reply_markup: new InlineKeyboard().text("🔙 Về danh mục", "menu_products") }
      );
      return;
    }

    const baseTotal = product.price * state.quantity;
    const couponCode = text.toUpperCase();
    const val = await validateCoupon(couponCode, baseTotal);

    if (!val.valid || val.finalPrice === undefined || val.discountAmount === undefined) {
      // Mã không hợp lệ -> giữ state để khách nhập lại hoặc bấm mua giá gốc
      const failKeyboard = new InlineKeyboard()
        .text(`💳 Mua theo giá gốc (${formatVND(baseTotal)})`, `skip_coupon:${state.productId}:${state.quantity}`)
        .row()
        .text("🔙 Chọn lại số lượng", `coupon_info:${state.productId}`)
        .row()
        .text("❌ Hủy giao dịch", "menu_products");

      await ctx.reply(
        `⚠️ <b>MÃ ƯU ĐÃI KHÔNG HỢP LỆ</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `• Mã Quý khách đã nhập: <code>${couponCode}</code>\n` +
        `• Nguyên nhân: <i>${val.error || "Mã không tồn tại hoặc đã hết hạn sử dụng"}</i>\n\n` +
        `Kính mời Quý khách <b>gửi lại mã khác</b>, hoặc bấm nút bên dưới để tiếp tục giao dịch:`,
        { parse_mode: "HTML", reply_markup: failKeyboard }
      );
      return;
    }

    // Mã hợp lệ! Xóa state và tạo đơn hàng
    checkoutStates.delete(telegramId);
    await incrementCouponUsage(couponCode);

    const finalPrice = val.finalPrice;
    const orderId = await generateOrderId();
    const username = ctx.from?.username || null;

    await prisma.order.create({
      data: {
        id: orderId,
        telegramId,
        username,
        productId: product.id,
        totalAmount: finalPrice,
        status: "PENDING",
      },
    });
    await prisma.$executeRawUnsafe(
      `UPDATE "Order" SET quantity = ? WHERE id = ?`,
      state.quantity,
      orderId
    );

    const qrBuffer = await fetchQRCodeBuffer(
      BANK_ID,
      BANK_ACCOUNT_NO,
      finalPrice,
      orderId,
      BANK_ACCOUNT_NAME
    );

    const paymentText =
      `✦ <b>ÁP DỤNG MÃ ƯU ĐÃI THÀNH CÔNG</b> ✦\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🏷 <b>Mã ưu đãi:</b> <code>${couponCode}</code>\n` +
      `💵 <b>Mức chiết khấu:</b> <b>-${formatVND(val.discountAmount)}</b>\n` +
      `---------------------------\n` +
      `🧾 <b>HÓA ĐƠN ĐẶT HÀNG:</b> <code>${orderId}</code>\n` +
      `📦 <b>Sản phẩm:</b> <b>${product.name}</b> (x${state.quantity})\n` +
      `💰 <b>Tổng thanh toán:</b> <b>${formatVND(finalPrice)}</b> (Đơn giá gốc: <s>${formatVND(baseTotal)}</s>)\n\n` +
      `🏦 <b>THÔNG TIN CHUYỂN KHOẢN TỰ ĐỘNG:</b>\n` +
      `• Ngân hàng: <b>${BANK_ID}</b>\n` +
      `• Số tài khoản: <code>${BANK_ACCOUNT_NO}</code>\n` +
      `• Chủ tài khoản: <b>${BANK_ACCOUNT_NAME}</b>\n` +
      `• Số tiền: <code>${finalPrice}</code>\n` +
      `• Nội dung chuyển khoản: <code>${orderId}</code>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📌 <b>HƯỚNG DẪN THANH TOÁN:</b>\n` +
      `1. Quý khách quét mã <b>VietQR</b> phía trên hoặc chuyển khoản đúng số tiền và nội dung.\n` +
      `2. Giữ NGUYÊN nội dung chuyển khoản là <code>${orderId}</code>.\n` +
      `3. Hệ thống sẽ tự động giao đủ <b>${state.quantity} tài nguyên</b> sau 3 - 5 giây!\n\n` +
      `<i>Xin trân trọng cảm ơn Quý khách!</i>`;

    const userRec = await prisma.telegramUser.findUnique({ where: { id: telegramId } }).catch(() => null);
    const userBalance = userRec?.balance || 0;

    const keyboard = new InlineKeyboard();
    if (userBalance >= finalPrice) {
      keyboard.text(`💳 Thanh toán bằng Số Dư Ví (${userBalance.toLocaleString("vi-VN")}đ)`, `pay_balance:${orderId}`).row();
    }
    keyboard.text("🔙 Hủy / Về danh mục", "menu_products");

    let sentQrMsg: any = null;
    if (qrBuffer) {
      try {
        sentQrMsg = await ctx.replyWithPhoto(new InputFile(qrBuffer, `vietqr_${orderId}.png`), {
          caption: paymentText,
          parse_mode: "HTML",
          reply_markup: keyboard,
        });
      } catch (photoErr) {
        console.error("Lỗi replyWithPhoto:", photoErr);
      }
    }

    if (!sentQrMsg) {
      sentQrMsg = await ctx.reply(paymentText, { parse_mode: "HTML", reply_markup: keyboard });
    }

    if (sentQrMsg?.message_id) {
      await prisma.$executeRawUnsafe(
        `UPDATE "Order" SET qrMessageId = ? WHERE id = ?`,
        sentQrMsg.message_id,
        orderId
      );
    }
    return;
  }

  return next();
});

// 15. Command /buy [productId] [couponCode] (Dành cho người thích gõ lệnh nhanh)
bot.command("buy", async (ctx) => {
  const args = ctx.message?.text
    .split(" ")
    .filter((s) => s.trim().length > 0)
    .slice(1);

  if (!args || args.length === 0) {
    await ctx.reply(
      "❌ Cú pháp: <code>/buy [MÃ_SP] [MÃ_GIẢM_GIÁ]</code>\nVí dụ: <code>/buy 1 RINQ10</code>",
      { parse_mode: "HTML" }
    );
    return;
  }

  const productId = parseInt(args[0], 10);
  const couponCode = args[1]?.trim().toUpperCase();

  const product = await fetchSingleProductWithSupplierMeta(productId);
  const stockCount = getProductStockCount(product);

  if (!product || stockCount === 0) {
    await ctx.reply("❌ Sản phẩm này không tồn tại hoặc đã hết hàng!");
    return;
  }

  let finalPrice = product.price;
  let discountNote = "";

  if (couponCode) {
    const val = await validateCoupon(couponCode, product.price);
    if (!val.valid || val.finalPrice === undefined || val.discountAmount === undefined) {
      await ctx.reply(
        `⚠️ ${val.error || "Mã không hợp lệ"}! Đơn hàng giữ giá gốc: ${formatVND(product.price)}`
      );
    } else {
      finalPrice = val.finalPrice;
      discountNote = `🏷 <b>Mã giảm giá [${couponCode}]:</b> -${formatVND(
        val.discountAmount
      )}\n`;
      await incrementCouponUsage(couponCode);
    }
  }

  const orderId = await generateOrderId();
  const telegramId = String(ctx.from?.id);
  const username = ctx.from?.username || null;

  await prisma.order.create({
    data: {
      id: orderId,
      telegramId,
      username,
      productId: product.id,
      totalAmount: finalPrice,
      status: "PENDING",
    },
  });
  await prisma.$executeRawUnsafe(
    `UPDATE "Order" SET quantity = 1 WHERE id = ?`,
    orderId
  );

  const qrBuffer = await fetchQRCodeBuffer(
    BANK_ID,
    BANK_ACCOUNT_NO,
    finalPrice,
    orderId,
    BANK_ACCOUNT_NAME
  );

  const paymentText =
    `🧾 <b>HÓA ĐƠN ĐẶT HÀNG:</b> <code>${orderId}</code>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `• <b>Sản phẩm:</b> <b>${product.name}</b>\n` +
    (discountNote ? `${discountNote}` : "") +
    `• <b>Tổng thanh toán:</b> <b>${formatVND(finalPrice)}</b>\n\n` +
    `🏦 <b>THÔNG TIN CHUYỂN KHOẢN TỰ ĐỘNG:</b>\n` +
    `• Ngân hàng: <b>${BANK_ID}</b>\n` +
    `• Số tài khoản: <code>${BANK_ACCOUNT_NO}</code>\n` +
    `• Chủ tài khoản: <b>${BANK_ACCOUNT_NAME}</b>\n` +
    `• Số tiền: <code>${finalPrice}</code>\n` +
    `• Nội dung chuyển khoản: <code>${orderId}</code>\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📌 <b>HƯỚNG DẪN THANH TOÁN:</b>\n` +
    `1. Quý khách quét mã <b>VietQR</b> phía trên hoặc chuyển khoản đúng số tiền và nội dung.\n` +
    `2. Giữ NGUYÊN nội dung chuyển khoản là <code>${orderId}</code> để đối soát tự động.\n` +
    `3. Bot sẽ tự động trả tài khoản/key ngay tại đây sau 3 - 5 giây!\n\n` +
    `<i>Xin trân trọng cảm ơn Quý khách!</i>`;

  const userRec = await prisma.telegramUser.findUnique({ where: { id: telegramId } }).catch(() => null);
  const userBalance = userRec?.balance || 0;

  const keyboard = new InlineKeyboard();
  if (userBalance >= finalPrice) {
    keyboard.text(`💳 Thanh toán bằng Số Dư Ví (${userBalance.toLocaleString("vi-VN")}đ)`, `pay_balance:${orderId}`).row();
  }
  keyboard.text("🔙 Hủy / Về danh mục", "menu_products");

  let sentQrMsg: any = null;
  if (qrBuffer) {
    try {
      sentQrMsg = await ctx.replyWithPhoto(
        new InputFile(qrBuffer, `vietqr_${orderId}.png`),
        {
          caption: paymentText,
          parse_mode: "HTML",
          reply_markup: keyboard,
        }
      );
    } catch {}
  }

  if (!sentQrMsg) {
    sentQrMsg = await ctx.reply(paymentText, { parse_mode: "HTML", reply_markup: keyboard });
  }

  if (sentQrMsg?.message_id) {
    await prisma.$executeRawUnsafe(
      `UPDATE "Order" SET qrMessageId = ? WHERE id = ?`,
      sentQrMsg.message_id,
      orderId
    );
  }
});


// 16. Callback: Khách bấm thanh toán bằng số dư ví
bot.callbackQuery(/^pay_balance:(DH[A-F0-9]+)$/, async (ctx) => {
  const telegramId = String(ctx.from.id);
  const orderId = ctx.match[1];

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { product: true, stocks: true },
  });

  if (!order || String(order.telegramId) !== telegramId) {
    await ctx.answerCallbackQuery({ text: "❌ Không tìm thấy đơn hàng!" }).catch(() => {});
    return;
  }

  if (order.status === "PAID") {
    await ctx.answerCallbackQuery({ text: "Đơn hàng này đã thanh toán rồi!" }).catch(() => {});
    return;
  }

  const user = await prisma.telegramUser.findUnique({ where: { id: telegramId } });
  const currentBalance = user?.balance || 0;

  if (currentBalance < order.totalAmount) {
    await ctx.answerCallbackQuery({
      text: `Số dư ví không đủ (${currentBalance.toLocaleString("vi-VN")}đ < ${order.totalAmount.toLocaleString("vi-VN")}đ)`,
      show_alert: true,
    }).catch(() => {});
    return;
  }

  await ctx.answerCallbackQuery({ text: "Đang trừ ví và cấp tài nguyên..." }).catch(() => {});

  // Trừ số dư người dùng
  await prisma.telegramUser.update({
    where: { id: telegramId },
    data: { balance: { decrement: order.totalAmount } },
  });
  await prisma.walletTransaction.create({
    data: {
      id: `PAY${randomBytes(4).toString("hex").toUpperCase()}`,
      telegramId,
      amount: -order.totalAmount,
      type: "PURCHASE",
      status: "SUCCESS",
      description: `Thanh toán đơn hàng #${order.id} (${order.product.name})`,
    },
  }).catch(() => {});

  const qty = Math.max(1, order.quantity || 1);
  let keysToDeliver: string[] = [];

  const availableStocks = await prisma.stockItem.findMany({
    where: { productId: order.productId, isSold: false, isFaulty: false },
    take: qty,
    orderBy: { id: "asc" },
  });

  if (availableStocks.length >= qty) {
    await prisma.$transaction(
      availableStocks.map((s) =>
        prisma.stockItem.update({
          where: { id: s.id },
          data: { isSold: true, orderId: order.id },
        })
      )
    );
    keysToDeliver = availableStocks.map((s) => decryptStock(s.data));
  } else if (order.product?.supplierVariantId) {
    try {
      const { fulfillFromSupplier } = await import("../lib/supplier-fulfillment");
      const fRes = await fulfillFromSupplier(order.product.supplierVariantId, qty, order.product?.price || 2_000_000);
      if (fRes.success && fRes.items.length > 0) {
        for (const rawKey of fRes.items) {
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
    } catch (err) {
      console.error("Lỗi mua supplier tự động:", err);
    }
  }

  const finalStatus = keysToDeliver.length >= qty ? "PAID" : "PAID_PENDING_FULFILLMENT";
  await prisma.order.update({
    where: { id: order.id },
    data: { status: finalStatus, paidAt: new Date() },
  });

  await ctx.deleteMessage().catch(() => {});

  if (finalStatus === "PAID" && keysToDeliver.length > 0) {
    const warrantyNotice = order.product?.warranty?.trim()
      ? `<blockquote>🛡️ <b>CHÍNH SÁCH BẢO HÀNH:</b>\n${order.product.warranty.trim()}</blockquote>\n\n`
      : "";

    await ctx.reply(
      `🎉 <b>THANH TOÁN BẰNG SỐ DƯ VÍ THÀNH CÔNG!</b>\n\n` +
      `Đã trừ <b>${order.totalAmount.toLocaleString("vi-VN")} đ</b> từ ví của bạn.\n` +
      `Số dư ví còn lại: <b>${(currentBalance - order.totalAmount).toLocaleString("vi-VN")} đ</b>\n\n` +
      `📦 <b>Sản phẩm:</b> ${order.product?.name} (x${qty})\n` +
      `🔑 <b>Tài nguyên bàn giao:</b>\n` +
      `<code>${keysToDeliver.map((k, i) => `#${i + 1}: ${k}`).join("\n")}</code>\n\n` +
      warrantyNotice +
      `<blockquote>💡 <i>Chạm vào mã để sao chép. Xin trân trọng cảm ơn Quý khách!</i></blockquote>`,
      {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard()
          .text("🛍 Mua tiếp", "menu_products")
          .row()
          .url("💬 Hỗ trợ Admin (@rinq_hotro)", "https://t.me/rinq_hotro"),
      }
    );

    if (ADMIN_TELEGRAM_ID) {
      const adminWalletMsg =
        `🔔 <b>[ĐƠN HÀNG MỚI · THANH TOÁN SỐ DƯ VÍ]</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🧾 <b>Mã đơn:</b> <code>#${order.id}</code>\n` +
        `👤 <b>Khách hàng:</b> <b>${order.username ? `@${order.username}` : telegramId}</b> (<code>${telegramId}</code>)\n` +
        `📦 <b>Sản phẩm:</b> <b>${order.product?.name}</b> (x${qty})\n` +
        `💰 <b>Trừ ví:</b> <b>${order.totalAmount.toLocaleString("vi-VN")} đ</b>\n` +
        `💳 <b>Số dư ví còn lại:</b> <b>${(currentBalance - order.totalAmount).toLocaleString("vi-VN")} đ</b>\n` +
        `🕒 <b>Thời gian:</b> ${new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`;

      bot.api.sendMessage(ADMIN_TELEGRAM_ID, adminWalletMsg, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              order.username
                ? { text: `💬 Nhắn @${order.username}`, url: `https://t.me/${order.username}` }
                : { text: "💬 Nhắn khách hàng", url: `tg://user?id=${telegramId}` },
            ],
          ],
        },
      }).catch(() => {});
    }
  } else {
    await ctx.reply(
      `✅ <b>ĐÃ THANH TOÁN BẰNG SỐ DƯ VÍ!</b>\n\n` +
      `Đã trừ <b>${order.totalAmount.toLocaleString("vi-VN")} đ</b> từ ví.\n` +
      `⏳ Kho đang chuẩn bị tài nguyên mới, Admin sẽ gửi key cho bạn ngay trong ít phút!`,
      {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard().url("💬 Hỗ trợ Admin (@rinq_hotro)", "https://t.me/rinq_hotro"),
      }
    );
  }
});

// 17. Lệnh Admin: Duyệt đơn hàng thủ công (/duyet <mã_đơn> [key_thủ_công])
bot.command("duyet", async (ctx) => {
  const adminId = String(ctx.from?.id);
  if (adminId !== ADMIN_TELEGRAM_ID) {
    await ctx.reply("⛔ Lệnh này chỉ dành riêng cho Admin @rinq_hotro!");
    return;
  }

  const parts = (ctx.message?.text || "").trim().split(/\s+/);
  const orderId = (parts[1] || "").toUpperCase();
  const customKey = parts.slice(2).join(" ");

  if (!orderId) {
    await ctx.reply(
      "📌 <b>CÚ PHÁP DUYỆT ĐƠN:</b>\n" +
      "<code>/duyet &lt;mã_đơn&gt; [tài_nguyên_nếu_có]</code>\n\n" +
      "<i>Ví dụ:</i>\n" +
      "• <code>/duyet DH00EAA491F28FC49D157A3098045D356B</code> (Tự tìm kho hoặc gọi API cấp)\n" +
      "• <code>/duyet DH00EAA491F28FC49D157A3098045D356B user|pass</code> (Cấp key trực tiếp)",
      { parse_mode: "HTML" }
    );
    return;
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { product: true, stocks: true },
  });

  if (!order) {
    await ctx.reply(`❌ Không tìm thấy đơn hàng có mã <code>${orderId}</code>!`, { parse_mode: "HTML" });
    return;
  }

  const qty = Math.max(1, order.quantity || 1);
  let keysToDeliver: string[] = [];

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
    keysToDeliver = order.stocks.map((s) => decryptStock(s.data));
  } else {
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

    if (keysToDeliver.length < qty && order.product?.supplierVariantId) {
      try {
        const { fulfillFromSupplier } = await import("../lib/supplier-fulfillment");
        const fRes = await fulfillFromSupplier(
          order.product.supplierVariantId,
          qty - keysToDeliver.length,
          order.product?.price || 2_000_000
        );
        if (fRes.success && fRes.items.length > 0) {
          for (const rawKey of fRes.items) {
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
      } catch (e) {
        console.error("Lỗi mua supplier:", e);
      }
    }
  }

  const finalStatus = keysToDeliver.length >= qty ? "PAID" : "PAID_PENDING_FULFILLMENT";
  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: finalStatus,
      paidAt: new Date(),
    },
  });

  if (order.telegramId) {
    let customerMsg = "";
    if (finalStatus === "PAID" && keysToDeliver.length > 0) {
      const warrantyNotice = order.product?.warranty?.trim()
        ? `<blockquote>🛡️ <b>CHÍNH SÁCH BẢO HÀNH:</b>\n${order.product.warranty.trim()}</blockquote>\n\n`
        : "";

      customerMsg =
        `🎉 <b>ĐƠN HÀNG ĐÃ ĐƯỢC DUYỆT THÀNH CÔNG!</b>\n\n` +
        `Kính gửi Quý khách, đơn hàng <code>#${order.id}</code> của Quý khách đã được Admin kiểm tra và duyệt hoàn tất:\n\n` +
        `📦 <b>Sản phẩm:</b> ${order.product?.name || "Sản phẩm"}\n` +
        `🔢 <b>Số lượng:</b> ${qty}\n` +
        `💰 <b>Số tiền:</b> ${order.totalAmount.toLocaleString("vi-VN")} đ\n\n` +
        `🔑 <b>Tài nguyên bàn giao:</b>\n` +
        `<code>${keysToDeliver.map((k, i) => `#${i + 1}: ${k}`).join("\n")}</code>\n\n` +
        warrantyNotice +
        `<blockquote>💡 <i>Chạm vào mã để sao chép. Nếu cần hỗ trợ thêm, Quý khách vui lòng liên hệ Admin @rinq_hotro.</i></blockquote>`;
    } else {
      customerMsg =
        `✅ <b>ĐƠN HÀNG ĐÃ ĐƯỢC DUYỆT THANH TOÁN!</b>\n\n` +
        `Kính gửi Quý khách, đơn hàng <code>#${order.id}</code> (${order.product?.name || "Sản phẩm"}) đã được Admin duyệt thành công.\n\n` +
        `⏳ Admin đang chuẩn bị tài nguyên và sẽ gửi cho bạn trong giây lát!\n\n` +
        `Cảm ơn Quý khách đã mua sắm tại RINQ SHOP!`;
    }

    await bot.api.sendMessage(order.telegramId, customerMsg, {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard().url("💬 Hỗ trợ Admin (@rinq_hotro)", "https://t.me/rinq_hotro"),
    }).catch(() => {});
  }

  await ctx.reply(
    `✅ <b>ĐÃ DUYỆT ĐƠN #${order.id} THÀNH CÔNG!</b>\n\n` +
    `• Khách hàng: <b>${order.username ? `@${order.username}` : order.telegramId}</b>\n` +
    `• Sản phẩm: <b>${order.product?.name}</b> (x${qty})\n` +
    `• Trạng thái: <b>${finalStatus === "PAID" ? "ĐÃ BÀN GIAO" : "CHỜ CẤP KEY"}</b>\n` +
    (keysToDeliver.length > 0
      ? `• Key cấp:\n<code>${keysToDeliver.join("\n")}</code>`
      : `⚠️ Chưa có đủ key trong kho! Đơn chuyển sang "Cần cấp hàng".`),
    { parse_mode: "HTML" }
  );
});

// 18. Lệnh Admin: Cộng tiền ví (/congtien <id hoặc username> <số_tiền> [lý do])
bot.command("congtien", async (ctx) => {
  const adminId = String(ctx.from?.id);
  if (adminId !== ADMIN_TELEGRAM_ID) {
    await ctx.reply("⛔ Lệnh này chỉ dành riêng cho Admin @rinq_hotro!");
    return;
  }

  const parts = (ctx.message?.text || "").trim().split(/\s+/);
  const target = (parts[1] || "").replace(/^@/, "");
  const amountStr = parts[2] || "";
  const reason = parts.slice(3).join(" ");
  const amount = parseInt(amountStr.replace(/\D/g, ""), 10);

  if (!target || !amount || amount <= 0) {
    await ctx.reply(
      "📌 <b>CÚ PHÁP CỘNG TIỀN VÍ:</b>\n" +
      "<code>/congtien &lt;telegram_id_hoặc_username&gt; &lt;số_tiền&gt; [lý_do]</code>\n\n" +
      "<i>Ví dụ:</i>\n" +
      "• <code>/congtien 123456789 20000 Hoàn tiền đơn lỗi</code>\n" +
      "• <code>/congtien @username 50000 Thưởng giveaway</code>",
      { parse_mode: "HTML" }
    );
    return;
  }

  let user = await prisma.telegramUser.findFirst({
    where: {
      OR: [
        { id: target },
        { username: { equals: target, mode: "insensitive" } },
      ],
    },
  });

  if (!user && /^\d+$/.test(target)) {
    user = await prisma.telegramUser.create({
      data: { id: target, balance: 0 },
    });
  }

  if (!user) {
    await ctx.reply(`❌ Không tìm thấy người dùng có ID hoặc username là <code>${target}</code>!`, { parse_mode: "HTML" });
    return;
  }

  const updatedUser = await prisma.telegramUser.update({
    where: { id: user.id },
    data: { balance: { increment: amount } },
  });
  await prisma.walletTransaction.create({
    data: {
      id: `ADJ${randomBytes(4).toString("hex").toUpperCase()}`,
      telegramId: user.id,
      amount: amount,
      type: "ADMIN_ADJUST",
      status: "SUCCESS",
      description: reason || "Admin cộng tiền ví",
    },
  }).catch(() => {});

  const notifyText =
    `💰 <b>BIẾN ĐỘNG SỐ DƯ VÍ RINQ SHOP</b>\n\n` +
    `➕ <b>+${amount.toLocaleString("vi-VN")} đ</b>\n` +
    `• Lý do: <b>${reason || "Admin cộng tiền / Hoàn tiền đơn hàng"}</b>\n` +
    `• Số dư ví hiện tại: <b>${(updatedUser.balance || 0).toLocaleString("vi-VN")} đ</b>\n\n` +
    `<blockquote>💡 <i>Quý khách có thể sử dụng số dư này để thanh toán ngay cho mọi sản phẩm trên Bot!</i></blockquote>`;

  await bot.api.sendMessage(user.id, notifyText, {
    parse_mode: "HTML",
    reply_markup: new InlineKeyboard()
      .text("🛍 Mua hàng ngay", "menu_products")
      .row()
      .url("💬 Hỗ trợ Admin (@rinq_hotro)", "https://t.me/rinq_hotro"),
  }).catch(() => {});

  await ctx.reply(
    `✅ <b>ĐÃ CỘNG TIỀN THÀNH CÔNG!</b>\n\n` +
    `• Người nhận: <b>${user.username ? `@${user.username}` : user.id}</b>\n` +
    `• Số tiền: <b>+${amount.toLocaleString("vi-VN")} đ</b>\n` +
    `• Lý do: ${reason || "Không ghi"}\n` +
    `• Số dư mới: <b>${(updatedUser.balance || 0).toLocaleString("vi-VN")} đ</b>`,
    { parse_mode: "HTML" }
  );
});

// 19. Lệnh Admin: Trừ tiền ví (/trutien <id hoặc username> <số_tiền> [lý do])
bot.command("trutien", async (ctx) => {
  const adminId = String(ctx.from?.id);
  if (adminId !== ADMIN_TELEGRAM_ID) {
    await ctx.reply("⛔ Lệnh này chỉ dành riêng cho Admin @rinq_hotro!");
    return;
  }

  const parts = (ctx.message?.text || "").trim().split(/\s+/);
  const target = (parts[1] || "").replace(/^@/, "");
  const amountStr = parts[2] || "";
  const reason = parts.slice(3).join(" ");
  const amount = parseInt(amountStr.replace(/\D/g, ""), 10);

  if (!target || !amount || amount <= 0) {
    await ctx.reply(
      "📌 <b>CÚ PHÁP TRỪ TIỀN VÍ:</b>\n" +
      "<code>/trutien &lt;telegram_id_hoặc_username&gt; &lt;số_tiền&gt; [lý_do]</code>",
      { parse_mode: "HTML" }
    );
    return;
  }

  const user = await prisma.telegramUser.findFirst({
    where: {
      OR: [
        { id: target },
        { username: { equals: target, mode: "insensitive" } },
      ],
    },
  });

  if (!user) {
    await ctx.reply(`❌ Không tìm thấy người dùng <code>${target}</code>!`, { parse_mode: "HTML" });
    return;
  }

  const newBalance = Math.max(0, (user.balance || 0) - amount);
  const updatedUser = await prisma.telegramUser.update({
    where: { id: user.id },
    data: { balance: newBalance },
  });
  await prisma.walletTransaction.create({
    data: {
      id: `ADJ${randomBytes(4).toString("hex").toUpperCase()}`,
      telegramId: user.id,
      amount: -amount,
      type: "ADMIN_ADJUST",
      status: "SUCCESS",
      description: reason || "Admin trừ tiền ví",
    },
  }).catch(() => {});

  await ctx.reply(
    `✅ <b>ĐÃ TRỪ TIỀN VÍ THÀNH CÔNG!</b>\n\n` +
    `• Khách: <b>${user.username ? `@${user.username}` : user.id}</b>\n` +
    `• Đã trừ: <b>-${amount.toLocaleString("vi-VN")} đ</b>\n` +
    `• Số dư mới: <b>${updatedUser.balance.toLocaleString("vi-VN")} đ</b>`,
    { parse_mode: "HTML" }
  );
});

// 20. Tính năng Ví RINQ SHOP & Nạp tiền tự động
function parseMoneyInput(raw: string): number {
  let s = (raw || "").trim().toLowerCase().replace(/[,.\sđvnd]/g, "");
  if (s.endsWith("k")) {
    s = s.slice(0, -1) + "000";
  } else if (s.endsWith("m") || s.endsWith("tr")) {
    s = s.replace(/(m|tr)$/, "") + "000000";
  }
  const num = parseInt(s, 10);
  return Number.isSafeInteger(num) && num > 0 ? num : 0;
}

async function renderWallet(ctx: any, deletePrevious = false, editInPlace = false) {
  if (deletePrevious) {
    await ctx.deleteMessage().catch(() => {});
  }

  const telegramId = String(ctx.from?.id);
  const user = await prisma.telegramUser.upsert({
    where: { id: telegramId },
    update: {
      username: ctx.from?.username || undefined,
      firstName: ctx.from?.first_name || undefined,
    },
    create: {
      id: telegramId,
      username: ctx.from?.username || null,
      firstName: ctx.from?.first_name || null,
      balance: 0,
    },
  });

  const balance = user.balance || 0;

  // Lấy các giao dịch gần đây (nạp, mua hàng, cộng tiền)
  const recentTxs = await prisma.walletTransaction.findMany({
    where: { telegramId, status: "SUCCESS" },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  let recentTransactionsText = "Chưa có giao dịch ví.\n";
  if (recentTxs.length > 0) {
    recentTransactionsText = recentTxs
      .map((t) => {
        const sign = t.amount >= 0 ? "+" : "";
        const icon = t.amount >= 0 ? "➕" : "➖";
        const time = new Date(t.createdAt).toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          day: "2-digit",
          month: "2-digit",
          timeZone: "Asia/Ho_Chi_Minh",
        });
        return `${icon} <b>${sign}${t.amount.toLocaleString("vi-VN")}đ</b> · ${t.description || (t.amount >= 0 ? "Nạp tiền ví" : "Thanh toán")} <i>(${time})</i>`;
      })
      .join("\n") + "\n";
  }

  const walletText =
    `💳 <b>VÍ RINQ SHOP CỦA BẠN</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 Chủ ví: <b>${ctx.from?.first_name || "Quý khách"}</b>\n` +
    `🆔 Mã định danh: <code>${telegramId}</code>\n` +
    `💰 <b>Số dư ví:</b> <b>${formatVND(balance)}</b>\n\n` +
    `<b>Giao dịch gần đây</b>\n` +
    `${recentTransactionsText}\n` +
    `Nạp nhanh bằng nút bên dưới hoặc gửi /nap 100000. Nạp ví không tự thanh toán đơn đang chờ.`;

  const walletKeyboard = new InlineKeyboard()
    .text("Nạp 20.000đ", "nap:20000")
    .text("Nạp 50.000đ", "nap:50000")
    .text("Nạp 100.000đ", "nap:100000")
    .row()
    .text("Nạp 200.000đ", "nap:200000")
    .text("Nạp 500.000đ", "nap:500000")
    .row()
    .text("✏️ Nhập số tiền khác", "nap_custom")
    .text("⚡ Làm mới số dư", "refresh_wallet")
    .row()
    .text("🛒 Xem sản phẩm", "menu_products");

  if (editInPlace && ctx.callbackQuery?.message) {
    try {
      await ctx.editMessageText(walletText, {
        parse_mode: "HTML",
        reply_markup: walletKeyboard,
      });
      return;
    } catch {}
  }

  await ctx.reply(walletText, {
    parse_mode: "HTML",
    reply_markup: walletKeyboard,
  });
}

async function handleDepositRequest(ctx: any, amount: number) {
  if (amount < 10000) {
    await ctx.reply("⚠️ Số tiền nạp tối thiểu là <b>10.000 đ</b>. Quý khách vui lòng thử lại!", { parse_mode: "HTML" });
    return;
  }
  if (amount > 50000000) {
    await ctx.reply("⚠️ Số tiền nạp tối đa mỗi lần là <b>50.000.000 đ</b>.", { parse_mode: "HTML" });
    return;
  }

  const telegramId = String(ctx.from?.id);
  const depositId = `NAP${randomBytes(4).toString("hex").toUpperCase()}`;

  await prisma.telegramUser.upsert({
    where: { id: telegramId },
    update: {
      username: ctx.from?.username || undefined,
      firstName: ctx.from?.first_name || undefined,
    },
    create: {
      id: telegramId,
      username: ctx.from?.username || null,
      firstName: ctx.from?.first_name || null,
      balance: 0,
    },
  });

  await prisma.walletTransaction.create({
    data: {
      id: depositId,
      telegramId,
      amount,
      type: "DEPOSIT",
      status: "PENDING",
      description: `Nạp tiền ví ${formatVND(amount)}`,
    },
  });

  const qrBuffer = await fetchQRCodeBuffer(
    BANK_ID,
    BANK_ACCOUNT_NO,
    amount,
    depositId,
    BANK_ACCOUNT_NAME
  );

  const depositText =
    `🧾 <b>HÓA ĐƠN NẠP TIỀN VÍ:</b> <code>${depositId}</code>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `• <b>Khách hàng:</b> <b>${ctx.from?.first_name || "Quý khách"}</b> (<code>${telegramId}</code>)\n` +
    `• <b>Số tiền nạp:</b> <b>${formatVND(amount)}</b>\n` +
    `• <b>Ưu đãi / Phí:</b> <b>Miễn phí (0đ)</b>\n` +
    `• <b>Thực nhận vào ví:</b> <b>${formatVND(amount)}</b>\n\n` +
    `🏦 <b>THÔNG TIN CHUYỂN KHOẢN TỰ ĐỘNG:</b>\n` +
    `• Ngân hàng: <b>${BANK_ID}</b>\n` +
    `• Số tài khoản: <code>${BANK_ACCOUNT_NO}</code>\n` +
    `• Chủ tài khoản: <b>${BANK_ACCOUNT_NAME}</b>\n` +
    `• Số tiền: <code>${amount}</code>\n` +
    `• Nội dung chuyển khoản: <code>${depositId}</code>\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📌 <b>HƯỚNG DẪN THANH TOÁN:</b>\n` +
    `1. Quý khách quét mã <b>VietQR</b> phía trên hoặc chuyển khoản theo thông tin trên (chạm vào dòng STK hoặc Nội dung để tự động sao chép).\n` +
    `2. Xin vui lòng giữ <b>NGUYÊN</b> nội dung chuyển khoản là <code>${depositId}</code> để hệ thống tự động cộng tiền.\n` +
    `3. <i>Nạp ví không tự thanh toán đơn đang chờ.</i>\n\n` +
    `<i>Sau khi nhận thanh toán, hệ thống sẽ tự động cộng số dư vào ví trong 3 - 5 giây!</i>`;

  const depositKeyboard = new InlineKeyboard()
    .text("⚡ Kiểm tra giao dịch", `check_deposit:${depositId}`)
    .row()
    .text("❌ Hủy giao dịch này", `cancel_deposit:${depositId}`)
    .row()
    .text("🔙 Quay lại ví", "menu_wallet");

  if (ctx.callbackQuery?.message) {
    await ctx.deleteMessage().catch(() => {});
  }

  let sentQrMsg: any = null;
  if (qrBuffer) {
    try {
      sentQrMsg = await ctx.replyWithPhoto(new InputFile(qrBuffer, `vietqr_${depositId}.png`), {
        caption: depositText,
        parse_mode: "HTML",
        reply_markup: depositKeyboard,
      });
    } catch {}
  }

  if (!sentQrMsg) {
    sentQrMsg = await ctx.reply(depositText, {
      parse_mode: "HTML",
      reply_markup: depositKeyboard,
    });
  }

  if (sentQrMsg?.message_id) {
    await prisma.walletTransaction.update({
      where: { id: depositId },
      data: { qrMessageId: sentQrMsg.message_id },
    }).catch(() => {});
  }
}

// Callbacks nạp tiền ví
bot.callbackQuery(/^nap:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  const amount = parseInt(ctx.match[1], 10);
  await handleDepositRequest(ctx, amount);
});

bot.callbackQuery("nap_custom", async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  const telegramId = String(ctx.from?.id);
  pendingDepositUsers.add(telegramId);
  await ctx.reply(
    `✏️ <b>NẠP TIỀN VÍ TỰ CHỌN:</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Quý khách chỉ cần <b>gõ số tiền và gửi trực tiếp vào khung chat</b> này:\n\n` +
    `• Ví dụ: <code>30000</code> hoặc <code>30k</code>\n` +
    `• Ví dụ: <code>150k</code> hoặc <code>500000</code>\n\n` +
    `<i>(Số tiền nạp tối thiểu là 10.000đ. Nhập 0 hoặc 'huy' để hủy)</i>`,
    { parse_mode: "HTML" }
  );
});

bot.callbackQuery("refresh_wallet", async (ctx) => {
  await ctx.answerCallbackQuery({ text: "⚡ Đã cập nhật số dư ví!" }).catch(() => {});
  await renderWallet(ctx, false, true);
});

bot.callbackQuery("menu_wallet", async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  await renderWallet(ctx, true);
});

bot.callbackQuery(/^check_deposit:(.+)$/, async (ctx) => {
  const depositId = ctx.match[1];
  const tx = await prisma.walletTransaction.findUnique({ where: { id: depositId } });
  if (!tx) {
    await ctx.answerCallbackQuery({ text: "❌ Không tìm thấy giao dịch!" });
    return;
  }
  if (tx.status === "SUCCESS") {
    await ctx.answerCallbackQuery({ text: "🎉 Nạp tiền ví thành công!" });
    await ctx.deleteMessage().catch(() => {});
    await renderWallet(ctx);
    return;
  }
  if (tx.status === "CANCELLED") {
    await ctx.answerCallbackQuery({ text: "⚠️ Giao dịch này đã bị hủy." });
    return;
  }
  await ctx.answerCallbackQuery({
    text: "⏳ Hệ thống đang chờ tiền vào... Vui lòng kiểm tra lại sau ít giây!",
    show_alert: true,
  });
});

bot.callbackQuery(/^cancel_deposit:(.+)$/, async (ctx) => {
  const depositId = ctx.match[1];
  await prisma.walletTransaction.updateMany({
    where: { id: depositId, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
  await ctx.answerCallbackQuery({ text: "Đã hủy giao dịch nạp tiền." });
  await ctx.deleteMessage().catch(() => {});
  await renderWallet(ctx);
});

// Lệnh ví & nạp tiền
bot.command(["vi", "taikhoan", "me", "wallet"], async (ctx) => {
  await renderWallet(ctx);
});

bot.command("nap", async (ctx) => {
  const rawArg = ctx.match?.trim() || "";
  if (!rawArg) {
    await renderWallet(ctx);
    return;
  }
  const amount = parseMoneyInput(rawArg);
  if (amount <= 0) {
    await ctx.reply(
      `⚠️ Số tiền không hợp lệ! Vui lòng gửi lệnh như: <code>/nap 100000</code> hoặc <code>/nap 50k</code>.`,
      { parse_mode: "HTML" }
    );
    return;
  }
  await handleDepositRequest(ctx, amount);
});

bot.hears(["💳 Ví của tôi", "Ví của tôi", "💳 Ví & Số dư", "Ví & Số dư", "Số dư ví", "Ví", "Nạp tiền"], async (ctx) => {
  await renderWallet(ctx);
});

// Lệnh dành riêng cho Admin: Tự động đồng bộ và chốt giá mới từ nhà cung cấp
bot.command(["syncprice", "capnhatgia"], async (ctx) => {
  const senderId = String(ctx.from?.id || "");
  if (senderId !== ADMIN_TELEGRAM_ID.trim()) {
    await ctx.reply("⛔ Lệnh này chỉ dành cho Quản trị viên.");
    return;
  }
  const waitMsg = await ctx.reply("⏳ Đang quét danh mục và đồng bộ giá từ nhà cung cấp RoboticVN...");
  try {
    const res = await syncRoboticPrices({ notifyAdmin: true, broadcastCustomersOnDiscount: true });
    await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
    if (!res.success) {
      await ctx.reply(`❌ Lỗi đồng bộ giá: ${res.error || "Không xác định"}`);
      return;
    }
    await ctx.reply(
      `✅ <b>ĐỒNG BỘ & CHỐT GIÁ THÀNH CÔNG!</b>\n\n` +
      `• Tổng sản phẩm kiểm tra: <b>${res.totalChecked}</b>\n` +
      `• Số sản phẩm có biến động giá: <b>${res.updatedCount}</b>\n\n` +
      (res.updatedCount === 0
        ? `<i>Giá tất cả sản phẩm đều đang khớp với nhà cung cấp.</i>`
        : `<i>Đã tự động chốt lại giá bán lẻ và cập nhật toàn bộ hệ thống.</i>`),
      { parse_mode: "HTML" }
    );
  } catch (err: any) {
    await ctx.reply(`❌ Lỗi: ${err.message || err}`);
  }
});

// Lệnh Flash Sale dành riêng cho Admin: /flashsale <discount%> <hours> [tên sự kiện]
bot.command("flashsale", async (ctx) => {
  const senderId = String(ctx.from?.id || "");
  if (senderId !== ADMIN_TELEGRAM_ID.trim()) {
    await ctx.reply("⛔ Lệnh này chỉ dành cho Quản trị viên.");
    return;
  }

  const args = (ctx.match || "").trim().split(/\s+/).filter(Boolean);
  const subCmd = (args[0] || "").toLowerCase();

  if (subCmd === "off" || subCmd === "tat" || subCmd === "stop") {
    await stopFlashSale();
    adminFlashSaleDrafts.delete(senderId);
    adminWaitingFlashSaleNote.delete(senderId);
    await ctx.reply("🛑 <b>ĐÃ TẮT FLASH SALE THÀNH CÔNG!</b> Giá sản phẩm đã trở về bình thường.", {
      parse_mode: "HTML",
    });
    return;
  }

  const discountPercent = parseInt(args[0], 10);
  const hours = parseFloat(args[1]) || 2;
  const customTitle = args.slice(2).join(" ") || "⚡ GIỜ VÀNG FLASH SALE";

  if (isNaN(discountPercent) || discountPercent <= 0 || discountPercent > 90) {
    const current = await getActiveFlashSale();
    let currentStatus = "Hiện không có Flash Sale nào đang bật.";
    if (current) {
      currentStatus = `🔥 Đang bật: <b>${current.title}</b> · Giảm <b>${current.discountPercent}%</b> · Còn <i>${formatRemainingTime(current.expiresAt)}</i>` +
        (current.note ? `\n💬 Ghi chú: <i>"${current.note}"</i>` : "");
    }

    await ctx.reply(
      `⚡ <b>QUẢN LÝ FLASH SALE · RINQ SHOP</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `${currentStatus}\n\n` +
      `📌 <b>Cú pháp kích hoạt:</b>\n` +
      `• <code>/flashsale &lt;%_giảm&gt; &lt;số_giờ&gt; [tên_sự_kiện]</code>\n` +
      `• Ví dụ: <code>/flashsale 20 2</code> (Giảm 20% trong 2 giờ)\n` +
      `• Ví dụ: <code>/flashsale 30 1 Giờ Vàng Đêm Khuya</code> (Giảm 30% trong 1 giờ)\n\n` +
      `📌 <b>Cú pháp tắt sớm:</b>\n` +
      `• <code>/flashsale off</code>`,
      { parse_mode: "HTML" }
    );
    return;
  }

  // Lưu bản nháp cấu hình và hỏi Admin có muốn thêm nội dung ghi chú không
  adminFlashSaleDrafts.set(senderId, { discountPercent, hours, title: customTitle });
  adminWaitingFlashSaleNote.delete(senderId);

  const promptKeyboard = new InlineKeyboard()
    .text("✏️ Thêm ghi chú / Thông điệp", "fs_add_note")
    .row()
    .text("🚀 Bật ngay (Không cần ghi chú)", "fs_launch_now")
    .row()
    .text("❌ Hủy bỏ", "fs_cancel");

  await ctx.reply(
    `⚡ <b>XÁC NHẬN KÍCH HOẠT FLASH SALE</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `• Mức giảm giá: <b>${discountPercent}%</b>\n` +
    `• Thời lượng: <b>${hours} giờ</b>\n` +
    `• Tên sự kiện: <b>${customTitle}</b>\n\n` +
    `❓ <b>Bạn có muốn thêm nội dung ghi chú / thông điệp gửi tới khách hàng không?</b>\n` +
    `<i>(Thông điệp này sẽ xuất hiện trên banner danh mục và tin nhắn thông báo gửi tới toàn bộ khách hàng)</i>`,
    { parse_mode: "HTML", reply_markup: promptKeyboard }
  );
});

// Callbacks xử lý xác nhận ghi chú Flash Sale
bot.callbackQuery("fs_launch_now", async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  const senderId = String(ctx.from?.id);
  const draft = adminFlashSaleDrafts.get(senderId);
  adminFlashSaleDrafts.delete(senderId);
  adminWaitingFlashSaleNote.delete(senderId);

  if (!draft) {
    await ctx.reply("Phiên cấu hình Flash Sale đã hết hạn. Vui lòng gõ lại lệnh.");
    return;
  }

  await launchFlashSaleAndNotify(ctx, draft.discountPercent, draft.hours, draft.title, null);
});

bot.callbackQuery("fs_add_note", async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  const senderId = String(ctx.from?.id);
  const draft = adminFlashSaleDrafts.get(senderId);

  if (!draft) {
    await ctx.reply("Phiên cấu hình Flash Sale đã hết hạn. Vui lòng gõ lại lệnh.");
    return;
  }

  adminWaitingFlashSaleNote.add(senderId);
  await ctx.reply(
    `✏️ <b>NHẬP NỘI DUNG GHI CHÚ / THÔNG ĐIỆP:</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Quý khách vui lòng gửi tin nhắn nội dung thông điệp gửi tới khách hàng vào đây:\n\n` +
    `• Ví dụ: <i>"Tri ân khách hàng cuối tuần, số lượng tài nguyên có hạn!"</i>\n\n` +
    `<i>(Nhập 'bo qua' để kích hoạt không ghi chú, hoặc 'huy' để hủy)</i>`,
    { parse_mode: "HTML" }
  );
});

bot.callbackQuery("fs_cancel", async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  const senderId = String(ctx.from?.id);
  adminFlashSaleDrafts.delete(senderId);
  adminWaitingFlashSaleNote.delete(senderId);
  await ctx.reply("Đã hủy cấu hình Flash Sale.");
});

async function launchFlashSaleAndNotify(
  ctx: any,
  discountPercent: number,
  hours: number,
  title: string,
  note: string | null
) {
  const fsConfig = await startFlashSale(discountPercent, hours, title, note);

  const noteDisplay = note ? `• Ghi chú: <i>"${note}"</i>\n` : "";

  await ctx.reply(
    `🔥 <b>ĐÃ KÍCH HOẠT FLASH SALE THÀNH CÔNG!</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `• Sự kiện: <b>${fsConfig.title}</b>\n` +
    `• Mức giảm giá: <b>${fsConfig.discountPercent}%</b>\n` +
    `• Thời hạn: <b>${hours} giờ</b> (Hết hạn lúc: ${new Date(fsConfig.expiresAt).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })})\n` +
    noteDisplay +
    `\n<i>Tất cả đơn giá trong danh mục bot đã tự động giảm theo tỷ lệ này!</i>`,
    { parse_mode: "HTML" }
  );

  // Tự động broadcast thông báo cho khách hàng
  try {
    const subscribers = await prisma.telegramUser.findMany({ select: { id: true } });
    const noteBlock = note ? `\n\n📝 <b>Thông điệp từ Shop:</b>\n<i>${note}</i>` : "";
    const broadcastText =
      `🔥 <b>${fsConfig.title.toUpperCase()} · RINQ SHOP</b> 🔥\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Kính gửi Quý khách, cửa hàng đang mở chương trình ưu đãi đặc biệt:\n\n` +
      `💥 Giảm ngay <b>${fsConfig.discountPercent}%</b> cho tất cả các gói dịch vụ!\n` +
      `⏱ Áp dụng trong <b>${hours} giờ</b> tới (hết hạn: ${new Date(fsConfig.expiresAt).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}).` +
      noteBlock +
      `\n\n👉 Kính mời Quý khách bấm <b>🗂 Xem sản phẩm</b> để săn sale ngay!`;

    const broadcastKeyboard = new InlineKeyboard().text("🛒 Vào xem sản phẩm giảm giá", "menu_products");

    for (const sub of subscribers) {
      bot.api.sendMessage(sub.id, broadcastText, {
        parse_mode: "HTML",
        reply_markup: broadcastKeyboard,
      }).catch(() => {});
    }
  } catch (err) {
    console.error("Lỗi broadcast flash sale:", err);
  }
}

// Bắt lỗi toàn cục
bot.catch((err) => {
  console.error("❌ Lỗi Telegram Bot:", err.message || err);
});

// Cài đặt danh sách lệnh sẵn cho nút Menu của Telegram Bot
async function registerBotCommands() {
  try {
    await bot.api.setMyCommands([
      { command: "start", description: "🛍️ Mở cửa hàng RINQ SHOP" },
      { command: "menu", description: "🛒 Danh mục sản phẩm & tồn kho" },
      { command: "orders", description: "📦 Lịch sử đơn hàng của tôi" },
      { command: "vi", description: "💳 Xem ví & số dư" },
      { command: "nap", description: "💰 Nạp tiền vào ví" },
      { command: "giveaway", description: "🎁 Sự kiện Giveaway tri ân" },
      { command: "help", description: "❓ Quy trình hướng dẫn mua hàng" },
      { command: "support", description: "💬 Hỗ trợ trực tuyến (@rinq_hotro)" },
    ]);
    console.log("✅ Đã cài đặt Menu lệnh sẵn (setMyCommands) thành công!");
  } catch (err: any) {
    console.error("Lỗi cài đặt Menu commands:", err.message || err);
  }
}

// Khởi chạy bot
console.log("🚀 Đang khởi động Telegram Bot...");

let heartbeatTimer: NodeJS.Timeout | null = null;
let priceSyncTimer: NodeJS.Timeout | null = null;

async function cleanupAndExit() {
  console.log("\n🛑 Đang dừng Bot...");
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  if (priceSyncTimer) clearInterval(priceSyncTimer);
  await stopBotHeartbeat().catch(() => {});
  process.exit(0);
}

process.on("SIGINT", cleanupAndExit);
process.on("SIGTERM", cleanupAndExit);

bot.start({
  onStart: async (botInfo) => {
    console.log(`✅ Telegram Bot @${botInfo.username} đã hoạt động sẵn sàng!`);
    await registerBotCommands();
    // Kích hoạt tín hiệu Bot Heartbeat cho Web Storefront
    await recordBotHeartbeat().catch(() => {});
    heartbeatTimer = setInterval(() => {
      recordBotHeartbeat().catch(() => {});
    }, 30000);

    // Tự động quét và chốt giá mới từ nhà cung cấp RoboticVN mỗi 30 phút
    priceSyncTimer = setInterval(async () => {
      try {
        await syncRoboticPrices({ notifyAdmin: true, broadcastCustomersOnDiscount: true });
      } catch (err) {
        console.error("Lỗi quét giá định kỳ:", err);
      }
    }, 30 * 60 * 1000);
  },
});
