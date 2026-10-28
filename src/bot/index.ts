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
import { decryptStock } from "../lib/crypto";
import { verifyWebAuthSession } from "../lib/web-auth";
import { recordBotHeartbeat, stopBotHeartbeat } from "../lib/bot-status";

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error("❌ LỖI: BOT_TOKEN chưa được cấu hình trong file .env");
  process.exit(1);
}

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
const WEB_APP_URL = process.env.WEB_APP_URL;

const mainMenuKeyboard = new Keyboard();
if (WEB_APP_URL && WEB_APP_URL.startsWith("http") && !WEB_APP_URL.includes("your-domain")) {
  mainMenuKeyboard.webApp("🚀 Mở Web Shop (Mini App)", WEB_APP_URL).row();
}
mainMenuKeyboard
  .text("🗂 Xem sản phẩm").text("📦 Đơn hàng của tôi").row()
  .text("🎁 Giveaway").text("❓ Hướng dẫn mua").row()
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

// Helper: Tính số lượng tồn kho khả dụng (bao gồm kết nối NCC API ẩn với khách)
export function getProductStockCount(p: any): number {
  if (!p) return 0;
  const manualCount = Array.isArray(p.stocks) ? p.stocks.length : (p.stockAvailable ?? 0);
  const supplierVariantId = p.supplierVariantId;
  const fulfillmentType = p.fulfillmentType || "HYBRID";

  // Nếu là sản phẩm thuần thủ công hoặc chưa gắn mã NCC
  if (fulfillmentType === "MANUAL" || !supplierVariantId || !String(supplierVariantId).trim()) {
    return manualCount;
  }

  // Nếu là thuần API
  if (fulfillmentType === "API") {
    return 99;
  }

  // Chế độ HYBRID: Nếu còn kho thủ công thì tính theo kho thủ công, nếu hết kho thủ công thì còn sẵn 99 từ API
  return manualCount > 0 ? manualCount : 99;
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
      `SELECT id, priceNote, supplierVariantId, fulfillmentType, imageUrl FROM "Product"`
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
      `SELECT priceNote, supplierVariantId, fulfillmentType, imageUrl FROM "Product" WHERE id = ?`,
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
      };
    }
  } catch {}
  return {
    ...product,
    priceNote: (product as any).priceNote || null,
    imageUrl: (product as any).imageUrl || null,
    supplierVariantId: (product as any).supplierVariantId || null,
    fulfillmentType: (product as any).fulfillmentType || "HYBRID",
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

  // Hiển thị danh sách từng Danh Mục để người dùng nhấn vào (VD: Gemini, Netflix...)
  Array.from(categoriesMap.entries()).forEach(([catName, catProducts]) => {
    const totalStock = catProducts.reduce((sum: number, item: any) => sum + getProductStockCount(item), 0);
    const stockBadge = totalStock > 0 ? `🟢 Còn ${totalStock}` : "🔴 Tạm hết";
    inlineKeyboard
      .text(`📁 ${catName} · ${catProducts.length} loại (${stockBadge})`, `cat:${catName}`)
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

  const messageText =
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

  products.forEach((p) => {
    const count = getProductStockCount(p);
    const stockBadge =
      count > 0
        ? p.stocks.length > 0
          ? `🟢 Còn ${count}`
          : "🟢 Sẵn hàng"
        : "🔴 Hết hàng";
    const label = `🔹 ${p.name} · ${p.price.toLocaleString("vi-VN")}đ · ${stockBadge}`;
    inlineKeyboard.text(label, `prod:${p.id}`).row();
  });

  inlineKeyboard.text("🔙 Quay lại danh mục chính", "menu_products").row();
  inlineKeyboard.text("🔄 Làm mới danh mục này", `cat:${categoryName}`).row();

  const title = isAll ? "TẤT CẢ CÁC GÓI SẢN PHẨM" : `DANH MỤC · ${categoryName.toUpperCase()}`;
  const totalStock = products.reduce((acc, cur) => acc + getProductStockCount(cur), 0);

  const text =
    `📁 <b>${title}</b>\n` +
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

  // Xóa tin nhắn danh mục cũ để thay thế bằng giao diện chi tiết sản phẩm
  await ctx.deleteMessage().catch(() => {});

  const stockStatusStr =
    stockCount > 0
      ? product.stocks.length > 0
        ? `🟢 Sẵn có <b>${product.stocks.length}</b> sản phẩm`
        : `🟢 Sẵn hàng (Giao tức thì 24/7)`
      : "🔴 Tạm hết hàng";

  const text =
    `❖ <b>${product.name.toUpperCase()}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `• <b>Đơn giá:</b> <b>${formatVND(product.price)}</b> / sản phẩm\n` +
    `• <b>Tình trạng:</b> ${stockStatusStr}\n` +
    `• <b>Hình thức giao dịch:</b> Giao tài nguyên tự động tức thì 24/7\n\n` +
    priceNoteText +
    `📝 <b>Thông tin & Mô tả chi tiết:</b>\n${desc}\n\n` +
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

  // Tạo đơn hàng ở trạng thái PENDING
  await prisma.order.create({
    data: {
      id: orderId,
      telegramId,
      username,
      productId: product.id,
      totalAmount: product.price,
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
    product.price,
    orderId,
    BANK_ACCOUNT_NAME
  );

  const paymentText =
    `🧾 <b>HÓA ĐƠN ĐẶT HÀNG:</b> <code>${orderId}</code>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `• <b>Sản phẩm:</b> <b>${product.name}</b>\n` +
    `• <b>Số lượng:</b> <b>1 sản phẩm</b>\n` +
    `• <b>Tổng thanh toán:</b> <b>${formatVND(product.price)}</b>\n\n` +
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

  const keyboard = new InlineKeyboard().text("🔙 Hủy / Về danh mục", "menu_products");

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

  const keyboard = new InlineKeyboard().text("🔙 Hủy / Về danh mục", "menu_products");

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

// 14. Lắng nghe tin nhắn văn bản từ người dùng (nhập mã giảm giá)
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
      "🎁 Giveaway",
      "❓ Hướng dẫn mua",
      "❓ Cách mua",
      "💬 Liên hệ hỗ trợ",
      "🎧 Liên hệ hỗ trợ",
    ].includes(text)
  ) {
    checkoutStates.delete(telegramId);
    return next();
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

    const keyboard = new InlineKeyboard().text("🔙 Hủy / Về danh mục", "menu_products");

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

  const keyboard = new InlineKeyboard().text(
    "🔙 Hủy / Về danh mục",
    "menu_products"
  );

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
      { command: "giveaway", description: "🎁 Sự kiện Giveaway tri ân" },
      { command: "help", description: "❓ Quy trình hướng dẫn mua hàng" },
      { command: "support", description: "💬 Hỗ trợ trực tuyến (@zophim)" },
    ]);
    console.log("✅ Đã cài đặt Menu lệnh sẵn (setMyCommands) thành công!");
  } catch (err: any) {
    console.error("Lỗi cài đặt Menu commands:", err.message || err);
  }
}

// Khởi chạy bot
console.log("🚀 Đang khởi động Telegram Bot...");

let heartbeatTimer: NodeJS.Timeout | null = null;

async function cleanupAndExit() {
  console.log("\n🛑 Đang dừng Bot...");
  if (heartbeatTimer) clearInterval(heartbeatTimer);
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
    }, 5000);
  },
});
