/**
 * RINQ SHOP - Likesub3s Supplier API Integration
 * Cổng kết nối nhà cung cấp API tự động
 */

const SUPPLIER_BASE_URL =
  process.env.SUPPLIER_BASE_URL || "https://api.likesub3s.com/api/v2";
const SUPPLIER_API_KEY = process.env.SUPPLIER_API_KEY || "";

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

/**
 * Tra cứu thông tin tài khoản và số dư ví tại nhà cung cấp
 */
export async function getSupplierInfo(): Promise<SupplierAccountInfo> {
  try {
    const res = await fetch(`${SUPPLIER_BASE_URL}/me`, {
      method: "GET",
      headers: {
        "x-api-key": SUPPLIER_API_KEY,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        connected: false,
        balanceVnd: 0,
        balanceUsd: 0,
        error: `HTTP ${res.status}: ${res.statusText}`,
      };
    }

    const json = await res.json();
    const d = json?.data || {};

    return {
      connected: true,
      telegramId: d.telegram_id,
      username: d.username,
      firstName: d.first_name,
      balanceVnd: Number(d.balance_vnd || 0),
      balanceUsd: Number(d.balance_usd || 0),
      vipLevel: d.vip_level || "NORMAL",
    };
  } catch (error: any) {
    return {
      connected: false,
      balanceVnd: 0,
      balanceUsd: 0,
      error: error?.message || "Không thể kết nối API NCC",
    };
  }
}

/**
 * Tạo đơn mua tự động từ số dư ví NCC
 */
export async function createSupplierOrder(
  variantId: string,
  quantity: number = 1
): Promise<{ success: boolean; orderId?: string; error?: string }> {
  try {
    const res = await fetch(`${SUPPLIER_BASE_URL}/orders`, {
      method: "POST",
      headers: {
        "x-api-key": SUPPLIER_API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        items: [{ variant_id: variantId, quantity }],
        currency_code: "vnd",
        payment_method: "wallet",
      }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg =
        json?.error?.message ||
        json?.message ||
        `Lỗi tạo đơn NCC (${res.status})`;
      return { success: false, error: errMsg };
    }

    const orderId =
      json?.data?.order_id ||
      json?.data?.id ||
      json?.data?.checkout_id;

    if (!orderId) {
      return {
        success: false,
        error: "Không nhận được mã đơn từ NCC sau khi đặt hàng",
      };
    }

    return { success: true, orderId: String(orderId) };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Lỗi kết nối khi đặt hàng NCC",
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
      const res = await fetch(`${SUPPLIER_BASE_URL}/orders/${orderId}/delivery`, {
        method: "GET",
        headers: {
          "x-api-key": SUPPLIER_API_KEY,
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
              rawText: rawText.trim() || item.data || item.code || "Thông tin tài khoản đã kích hoạt",
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
 * Lấy danh sách sản phẩm từ NCC và lọc theo giá tối đa (mặc định 40.000đ)
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
    const res = await fetch(`${SUPPLIER_BASE_URL}/products?limit=100`, {
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
        `Lỗi gọi API NCC (${res.status})`;
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

    const filtered: any[] = [];
    for (const p of items) {
      // Nếu sản phẩm có danh sách variants
      if (Array.isArray(p.variants) && p.variants.length > 0) {
        for (const v of p.variants) {
          const vPrice = Number(
            v?.prices?.vnd ?? v?.price_vnd ?? v?.price ?? p.price ?? 0
          );
          if (vPrice <= maxPrice && vPrice > 0) {
            filtered.push({
              id: String(p.id),
              variantId: String(v.id || p.id),
              title: `${p.title || p.name} - ${v.title || "Gói chuẩn"}`,
              price: vPrice,
              description: p.description || null,
              category: p.category || "AI",
              thumbnail: p.thumbnail || null,
            });
          }
        }
      } else {
        const price = Number(p.price || p.price_vnd || 0);
        if (price <= maxPrice && price > 0) {
          filtered.push({
            id: String(p.id),
            variantId: String(p.variant_id || p.id),
            title: String(p.title || p.name),
            price: price,
            description: p.description || null,
            category: p.category || "AI",
            thumbnail: p.thumbnail || null,
          });
        }
      }
    }

    return { success: true, products: filtered };
  } catch (err: any) {
    return {
      success: false,
      products: [],
      error: err?.message || "Không thể kết nối máy chủ NCC",
    };
  }
}
