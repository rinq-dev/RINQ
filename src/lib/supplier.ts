/**
 * RINQ SHOP - RoboticVN Supplier API Integration
 * Cổng kết nối nhà cung cấp API tự động
 */

const SUPPLIER_BASE_URL =
  process.env.SUPPLIER_BASE_URL || "https://api.roboticvn.com/api/v2";
const SUPPLIER_API_KEY =
  process.env.SUPPLIER_API_KEY || "";

function requireSupplierApiKey() {
  if (!SUPPLIER_API_KEY) throw new Error("SUPPLIER_API_KEY chưa được cấu hình");
  return SUPPLIER_API_KEY;
}

export interface SupplierAccountInfo {
  connected: boolean;
  telegramId?: string;
  username?: string;
  firstName?: string;
  balanceVnd: number;
  balanceUsd: number;
  vipLevel?: string;
  error?: string;
}

export interface SupplierDeliveryItem {
  account?: string | null;
  password?: string | null;
  additional_info?: string | null;
  rawText: string;
}

let cachedSupplierInfo: { data: SupplierAccountInfo; expiresAt: number } | null = null;

/**
 * Tra cứu thông tin tài khoản và số dư ví tại RoboticVN (có cache 60s và timeout 3s)
 */
export async function getSupplierInfo(forceRefresh = false): Promise<SupplierAccountInfo> {
  const now = Date.now();
  if (!forceRefresh && cachedSupplierInfo && cachedSupplierInfo.expiresAt > now) {
    return cachedSupplierInfo.data;
  }

  try {
    const apiKey = requireSupplierApiKey();
    const [meRes, balRes] = await Promise.all([
      fetch(`${SUPPLIER_BASE_URL}/me`, {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
          Accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      }),
      fetch(`${SUPPLIER_BASE_URL}/wallet/balance`, {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
          Accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      }),
    ]);

    if (!meRes.ok) {
      return {
        connected: false,
        balanceVnd: 0,
        balanceUsd: 0,
        error: `HTTP ${meRes.status}: ${meRes.statusText}`,
      };
    }

    const meJson = await meRes.json().catch(() => ({}));
    const balJson = await balRes.json().catch(() => ({}));
    const meData = meJson?.data || {};
    const balData = balJson?.data || {};

    const info: SupplierAccountInfo = {
      connected: true,
      telegramId: meData.telegram_id || undefined,
      username: meData.first_name || meData.username || "RoboticVN",
      firstName: meData.first_name || undefined,
      balanceVnd: Number(balData.vnd ?? balData.balance_vnd ?? 0),
      balanceUsd: Number(balData.usd ?? balData.balance_usd ?? 0),
      vipLevel: "VIP",
    };

    cachedSupplierInfo = { data: info, expiresAt: now + 60000 };
    return info;
  } catch (error: any) {
    const fallback: SupplierAccountInfo = {
      connected: false,
      balanceVnd: 0,
      balanceUsd: 0,
      error: error?.message || "Không thể kết nối API RoboticVN",
    };
    if (cachedSupplierInfo) return cachedSupplierInfo.data;
    return fallback;
  }
}

/**
 * Tạo đơn mua tự động từ số dư ví RoboticVN
 */
export async function createSupplierOrder(
  variantId: string,
  quantity: number = 1
): Promise<{ success: boolean; orderId?: string; error?: string }> {
  try {
    const apiKey = requireSupplierApiKey();
    const normalizedVariantId = variantId.includes(":")
      ? variantId.split(":").pop() || variantId
      : variantId;
    const res = await fetch(`${SUPPLIER_BASE_URL}/orders`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        items: [{ variant_id: normalizedVariantId, quantity }],
        currency_code: "vnd",
        payment_method: "wallet",
      }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg =
        json?.error?.message ||
        json?.message ||
        `Lỗi tạo đơn NCC RoboticVN (${res.status})`;
      return { success: false, error: errMsg };
    }

    const orderId =
      json?.data?.order_id ||
      json?.data?.id ||
      json?.data?.checkout_id ||
      json?.order_id ||
      json?.id;

    if (!orderId) {
      return {
        success: false,
        error: "Không nhận được mã đơn từ NCC RoboticVN sau khi đặt hàng",
      };
    }

    return { success: true, orderId: String(orderId) };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Lỗi kết nối khi đặt hàng NCC RoboticVN",
    };
  }
}

/**
 * Lấy tài nguyên (tài khoản/mật khẩu) từ đơn hàng NCC đã hoàn tất
 */
export async function getSupplierDelivery(
  orderId: string,
  maxRetries: number = 4,
  delayMs: number = 2500
): Promise<{ success: boolean; items: SupplierDeliveryItem[]; error?: string }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const apiKey = requireSupplierApiKey();
      const res = await fetch(`${SUPPLIER_BASE_URL}/orders/${orderId}/delivery`, {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (res.ok) {
        const json = await res.json();
        const list =
          json?.data?.delivered_accounts ||
          json?.data?.deliveredAccount ||
          json?.delivered_accounts ||
          json?.deliveredAccount ||
          [];

        if (Array.isArray(list) && list.length > 0) {
          const items: SupplierDeliveryItem[] = list.map((item: any) => {
            const acc = item.account || "";
            const pass = item.password || "";
            const extra = item.additional_info || "";

            // Format chuẩn để khách nhận
            let rawText = acc;
            if (pass) rawText += ` | ${pass}`;
            if (extra) rawText += ` | ${extra}`;

            return {
              account: acc,
              password: pass,
              additional_info: extra,
              rawText:
                rawText.trim() ||
                item.data ||
                item.code ||
                item.title ||
                "Thông tin tài khoản đã kích hoạt",
            };
          });

          return { success: true, items };
        }
      }

      // Đợi trước khi thử lại nếu đơn hàng NCC đang xử lý
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    } catch {
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  return {
    success: false,
    items: [],
    error: `Đơn NCC ${orderId} đã tạo nhưng chưa có tài nguyên giao ngay. Vui lòng kiểm tra lại trên web NCC.`,
  };
}

/**
 * Chuẩn hóa tên sản phẩm, danh mục và mô tả sang Tiếng Việt thân thiện
 */
export function localizeSupplierProduct(rawTitle: string, rawDesc?: string | null): {
  title: string;
  description: string;
  category: string;
} {
  let title = rawTitle.trim();
  let desc = (rawDesc || "").trim();
  let category = "Tài Khoản Cao Cấp";

  const lower = title.toLowerCase();

  // 1. Nhận diện danh mục chuẩn Tiếng Việt
  if (
    lower.includes("chatgpt") ||
    lower.includes("gpt") ||
    lower.includes("claude") ||
    lower.includes("gemini") ||
    lower.includes("grok") ||
    lower.includes("midjourney") ||
    lower.includes("muse") ||
    lower.includes("poe") ||
    lower.includes("token") ||
    lower.includes("elevenlabs")
  ) {
    category = "AI";
  } else if (
    lower.includes("canva") ||
    lower.includes("capcut") ||
    lower.includes("adobe") ||
    lower.includes("figma") ||
    lower.includes("photoshop")
  ) {
    category = "Đồ Họa & Video";
  } else if (
    lower.includes("spotify") ||
    lower.includes("netflix") ||
    lower.includes("youtube") ||
    lower.includes("apple music") ||
    lower.includes("phim")
  ) {
    category = "Giải Trí";
  } else if (
    lower.includes("duolingo") ||
    lower.includes("coursera") ||
    lower.includes("udemy") ||
    lower.includes("elsa") ||
    lower.includes("grammarly") ||
    lower.includes("quillbot")
  ) {
    category = "Học Tập";
  } else if (
    lower.includes("vpn") ||
    lower.includes("key") ||
    lower.includes("windows") ||
    lower.includes("office") ||
    lower.includes("drive") ||
    lower.includes("cloud")
  ) {
    category = "Phần Mềm & Tiện Ích";
  }

  // 2. Chuẩn hóa tên sản phẩm sang Tiếng Việt gọn gàng, bỏ mã kỹ thuật NCC
  title = title
    .replace(/\b1D\b/gi, "1 Ngày")
    .replace(/\b6D\b/gi, "6 Ngày")
    .replace(/\b7D\b/gi, "7 Ngày")
    .replace(/\b15D\b/gi, "15 Ngày")
    .replace(/\b30D\b/gi, "30 Ngày")
    .replace(/\b1M\b/gi, "1 Tháng")
    .replace(/\b3M\b/gi, "3 Tháng")
    .replace(/\b6M\b/gi, "6 Tháng")
    .replace(/\b12M\b/gi, "1 Năm")
    .replace(/\b24M\b/gi, "2 Năm")
    .replace(/\b12 MONTHS\b/gi, "12 Tháng")
    .replace(/\bYEARS\b/gi, "Năm")
    .replace(/\bYEAR\b/gi, "Năm")
    .replace(/\s*\((?:FW|NW|W5H|W2D|W7D|W24H)\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  // 3. Việt hóa nội dung mô tả
  if (desc) {
    desc = desc
      .replace(/Instructions\s*\d*\.?/gi, "📌 Hướng dẫn sử dụng:")
      .replace(/Keep your account logged in through your browser/gi, "Duy trì đăng nhập tài khoản trên trình duyệt của bạn")
      .replace(/Format\s*:\s*Email\s*\|\s*Pass\s*\|\s*2fa/gi, "Định dạng bàn giao: Email | Mật khẩu | Mã 2FA")
      .replace(/Format\s*:/gi, "Định dạng bàn giao:")
      .replace(/No warranty/gi, "Không bảo hành lỗi người dùng")
      .replace(/Full warranty/gi, "Bảo hành trọn thời gian sử dụng")
      .replace(/Please change password/gi, "Vui lòng đổi mật khẩu sau khi nhận")
      .trim();
  }

  return { title, description: desc, category };
}

/**
 * Lấy danh sách sản phẩm từ NCC RoboticVN và lọc theo giá tối đa (mặc định 40.000đ)
 */
export async function fetchSupplierProducts(maxPrice = 40000): Promise<{
  success: boolean;
  products: Array<{
    id: string;
    variantId: string;
    title: string;
    price: number;
    description?: string;
    category?: string;
    thumbnail?: string;
  }>;
  error?: string;
}> {
  try {
    const res = await fetch(`${SUPPLIER_BASE_URL}/products?limit=50`, {
      method: "GET",
      headers: {
        "x-api-key": SUPPLIER_API_KEY,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg =
        json?.error?.message ||
        json?.message ||
        `Lỗi gọi API NCC RoboticVN (${res.status})`;
      return { success: false, products: [], error: errMsg };
    }

    const items = json?.data || [];
    if (!Array.isArray(items)) {
      return {
        success: false,
        products: [],
        error: "Dữ liệu trả về không phải danh sách",
      };
    }

    // Tải chi tiết các sản phẩm (tối đa 25 sản phẩm để đảm bảo tốc độ và giới hạn API)
    const productSlice = items.slice(0, 25);
    const detailsResponses = await Promise.all(
      productSlice.map((p: any) =>
        fetch(`${SUPPLIER_BASE_URL}/products/${p.id}`, {
          method: "GET",
          headers: {
            "x-api-key": SUPPLIER_API_KEY,
            Accept: "application/json",
          },
          cache: "no-store",
        })
          .then((r) => r.json())
          .catch(() => null)
      )
    );

    const filtered: any[] = [];
    for (const d of detailsResponses) {
      const p = d?.data;
      if (!p) continue;

      if (Array.isArray(p.variants) && p.variants.length > 0) {
        for (const v of p.variants) {
          const vPrice = Number(
            v?.prices?.vnd ?? v?.price_vnd ?? v?.price ?? 0
          );
          if (vPrice <= maxPrice && vPrice > 0 && v.in_stock !== false) {
            const rawTitle = `${p.title || p.name} - ${v.title || "Gói chuẩn"}`;
            const localized = localizeSupplierProduct(rawTitle, v.description || p.description);

            filtered.push({
              id: String(p.id),
              variantId: String(v.id),
              title: localized.title,
              price: vPrice,
              description: localized.description || null,
              category: localized.category,
              thumbnail: p.thumbnail || null,
            });
          }
        }
      }
    }

    return { success: true, products: filtered };
  } catch (err: any) {
    return {
      success: false,
      products: [],
      error: err?.message || "Không thể kết nối máy chủ NCC RoboticVN",
    };
  }
}
