const ROBOTIC_BASE_URL = process.env.SUPPLIER_BASE_URL || "https://api.roboticvn.com/api/v2";

export interface RoboticProduct {
  id: string;
  variantId: string;
  name: string;
  description: string;
  category: string;
  sourcePrice: number;
  stock: number;
  imported: boolean;
  localProductId: number | null;
  localActive: boolean;
  localPrice: number | null;
}

function apiKey() {
  const key = (process.env.ROBOTIC_API_KEY || process.env.SUPPLIER_API_KEY || "").trim();
  if (!key) throw new Error("Thiếu ROBOTIC_API_KEY trong cấu hình máy chủ.");
  return key;
}

function fetchWithTimeout(url: string, init?: RequestInit, ms = 6000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, {
    ...init,
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));
}

async function roboticRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetchWithTimeout(`${ROBOTIC_BASE_URL}${path}`, {
    ...init,
    headers: { "x-api-key": apiKey(), Accept: "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  }, 6000);
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message;
    throw new Error(typeof message === "string" ? message : `RoboticVN API lỗi HTTP ${response.status}.`);
  }
  return payload?.data as T;
}

const productDetailCache = new Map<string, { detail: any; expiresAt: number }>();
let cachedSummaries: { items: Array<{ id: string; title: string }>; expiresAt: number } | null = null;
let cachedAccount: { data: any; expiresAt: number } | null = null;
let cachedRoboticCatalog: {
  account: any;
  products: RoboticProduct[];
  expiresAt: number;
} | null = null;

export interface GetRoboticCatalogOptions {
  maxPrice?: number;
  offset?: number;
  limit?: number;
  forceRefresh?: boolean;
}

export async function getRoboticCatalog(
  options: GetRoboticCatalogOptions | number = {},
  forceRefreshArg = false
) {
  const opts: GetRoboticCatalogOptions =
    typeof options === "number" ? { maxPrice: options, forceRefresh: forceRefreshArg } : options;
  const maxPrice = opts.maxPrice ?? 2_147_483_647;
  const offset = Math.max(0, opts.offset ?? 0);
  const limit = Math.max(1, Math.min(100, opts.limit ?? 35));
  const forceRefresh = opts.forceRefresh ?? false;
  const now = Date.now();

  let account = cachedAccount?.data;
  let summaries = cachedSummaries?.items;

  const initialFetches: Promise<any>[] = [];

  if (offset === 0 && (!account || cachedAccount!.expiresAt <= now || forceRefresh)) {
    initialFetches.push(
      Promise.all([
        roboticRequest<{ first_name?: string | null; last_name?: string | null }>("/me").catch(() => ({ first_name: "RoboticVN" })),
        roboticRequest<Record<string, number>>("/wallet/balance").catch(() => ({ vnd: 0, usd: 0 })),
      ]).then(([profile, balance]) => {
        account = {
          username: profile?.first_name || "RoboticVN",
          balanceVnd: Number(balance?.vnd || 0),
          balanceUsd: Number(balance?.usd || 0),
          currency: "VND",
        };
        cachedAccount = { data: account, expiresAt: now + 5 * 60 * 1000 };
      })
    );
  }

  if (!summaries || cachedSummaries!.expiresAt <= now || forceRefresh) {
    initialFetches.push(
      roboticRequest<Array<{ id: string; title: string }>>("/products?limit=100&offset=0&locale=vi-VN")
        .catch(() => [])
        .then((items) => {
          summaries = Array.isArray(items) ? items : [];
          cachedSummaries = { items: summaries, expiresAt: now + 10 * 60 * 1000 };
        })
    );
  }

  if (initialFetches.length > 0) {
    await Promise.all(initialFetches);
  }

  const allSummaries = summaries || [];
  const targetSummaries = allSummaries.slice(offset, offset + limit);

  // Chỉ fetch các sản phẩm chưa có trong cache
  const uncachedNeeded: Array<{ id: string; title: string }> = [];
  for (const s of targetSummaries) {
    const cached = productDetailCache.get(s.id);
    if (!cached || cached.expiresAt <= now) {
      uncachedNeeded.push(s);
    }
  }

  // Tối đa 36 fetch mới mỗi request chạy song song cực nhanh (< 1 giây)
  const toFetch = uncachedNeeded.slice(0, 36);
  if (toFetch.length > 0) {
    await Promise.all(
      toFetch.map(async (summary) => {
        try {
          const detail = await roboticRequest<any>(`/products/${encodeURIComponent(summary.id)}?locale=vi-VN`);
          if (detail) {
            productDetailCache.set(summary.id, { detail, expiresAt: now + 30 * 60 * 1000 });
          }
        } catch {}
      })
    );
  }

  const products: RoboticProduct[] = [];
  for (const summary of targetSummaries) {
    const cached = productDetailCache.get(summary.id);
    const detail = cached?.detail;
    if (!detail) continue;

    for (const variant of Array.isArray(detail?.variants) ? detail.variants : []) {
      const price = Number(variant?.prices?.vnd || 0);
      const stock = Number(variant?.available_quantity || 0);
      if (!variant?.id || price < 1 || variant.in_stock === false || stock < 1) continue;
      products.push({
        id: String(summary.id),
        variantId: String(variant.id),
        name: `${summary.title || detail.title} - ${variant.title || "Gói chuẩn"}`.trim(),
        description: String(variant.description || detail.description || "").trim(),
        category: String(summary.title || "RoboticVN").replace(/[^\p{L}\p{N}\s&-]/gu, "").trim() || "RoboticVN",
        sourcePrice: price,
        stock,
        imported: false,
        localProductId: null,
        localActive: false,
        localPrice: null,
      });
    }
  }

  return {
    account: account || {
      username: "RoboticVN",
      balanceVnd: 0,
      balanceUsd: 0,
      currency: "VND",
    },
    products: products.filter((p) => p.sourcePrice <= maxPrice),
    hasMore: offset + limit < allSummaries.length,
    totalSummaries: allSummaries.length,
    offset,
    limit,
  };
}

export async function createRoboticOrder(variantId: string, quantity: number, idempotencyKey: string) {
  const checkout = await roboticRequest<any>("/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ items: [{ variant_id: variantId, quantity }], currency_code: "vnd", payment_method: "wallet" }),
  });
  const orderId = String(checkout?.order_id || checkout?.id || checkout?.checkout_id || "");
  if (!orderId) throw new Error("RoboticVN không trả về mã đơn hợp lệ.");
  for (let attempt = 0; attempt < 8; attempt++) {
    const delivery = await roboticRequest<any>(`/orders/${encodeURIComponent(orderId)}/delivery`);
    const raw = delivery?.deliveredAccount || delivery?.delivered_accounts || [];
    if (Array.isArray(raw) && raw.length) {
      return { orderId, items: raw.map((item: any) => ({
        account: item.account || "", password: item.password || "", additional_info: item.additional_info || "",
        rawText: [item.account, item.password, item.additional_info].filter(Boolean).join(" | ") || item.display_title || item.title || "",
      })) };
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error(`Đơn RoboticVN ${orderId} đã tạo nhưng chưa có tài nguyên giao.`);
}

export function roboticRetailPrice(sourcePrice: number, marginPercent: number) {
  return Math.ceil((sourcePrice * (1 + marginPercent / 100)) / 1000) * 1000;
}

export async function getRoboticProductDetail(productId: string) {
  const cached = productDetailCache.get(productId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.detail;
  }
  const detail = await roboticRequest<any>(`/products/${encodeURIComponent(productId)}?locale=vi-VN`);
  if (detail) {
    productDetailCache.set(productId, { detail, expiresAt: Date.now() + 30 * 60 * 1000 });
  }
  return detail;
}

export async function getRoboticVariant(productId: string, variantId: string): Promise<RoboticProduct | null> {
  const detail = await getRoboticProductDetail(productId);
  if (!detail) return null;
  const variant = Array.isArray(detail?.variants)
    ? detail.variants.find((v: any) => String(v.id) === variantId)
    : null;
  if (!variant) return null;
  const price = Number(variant?.prices?.vnd || 0);
  const stock = Number(variant?.available_quantity || 0);
  return {
    id: String(productId),
    variantId: String(variant.id),
    name: `${detail.title} - ${variant.title || "Gói chuẩn"}`.trim(),
    description: String(variant.description || detail.description || "").trim(),
    category: String(detail.title || "RoboticVN").replace(/[^\p{L}\p{N}\s&-]/gu, "").trim() || "RoboticVN",
    sourcePrice: price,
    stock,
    imported: false,
    localProductId: null,
    localActive: false,
    localPrice: null,
  };
}

export async function getRoboticProductsByKeys(keys: string[]): Promise<RoboticProduct[]> {
  const productIds = [...new Set(keys.map((k) => k.split(":")[0]))];
  const details = await Promise.all(
    productIds.map(async (pid) => {
      try {
        return { pid, detail: await getRoboticProductDetail(pid) };
      } catch {
        return { pid, detail: null };
      }
    })
  );
  const detailMap = new Map(details.map((d) => [d.pid, d.detail]));
  const results: RoboticProduct[] = [];

  for (const key of keys) {
    const [productId, variantId] = key.split(":");
    const detail = detailMap.get(productId);
    if (!detail) continue;
    const variant = Array.isArray(detail?.variants)
      ? detail.variants.find((v: any) => String(v.id) === variantId)
      : null;
    if (!variant) continue;
    const price = Number(variant?.prices?.vnd || 0);
    const stock = Number(variant?.available_quantity || 0);
    results.push({
      id: String(productId),
      variantId: String(variant.id),
      name: `${detail.title} - ${variant.title || "Gói chuẩn"}`.trim(),
      description: String(variant.description || detail.description || "").trim(),
      category: String(detail.title || "RoboticVN").replace(/[^\p{L}\p{N}\s&-]/gu, "").trim() || "RoboticVN",
      sourcePrice: price,
      stock,
      imported: false,
      localProductId: null,
      localActive: false,
      localPrice: null,
    });
  }

  return results;
}
