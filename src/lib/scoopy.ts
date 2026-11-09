const SCOOPY_BASE_URL = "https://scoopyvn.shop/api/shop/v1";

export interface ScoopyProduct {
  id: string;
  name: string;
  description: string;
  group: string;
  price_vnd: number;
  retail_price_vnd: number;
  currency: "VND";
  stock: number;
}

function requireApiKey() {
  const key = process.env.SCOOPY_API_KEY?.trim();
  if (!key) throw new Error("Thiếu SCOOPY_API_KEY trong cấu hình máy chủ.");
  return key;
}

async function scoopyRequest<T>(path: string): Promise<T> {
  const response = await fetch(`${SCOOPY_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${requireApiKey()}`,
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success !== true) {
    const message = payload?.error?.message;
    throw new Error(typeof message === "string" ? message : `Scoopy API lỗi HTTP ${response.status}.`);
  }
  return payload.data as T;
}

export async function getScoopyCatalog() {
  const [account, products] = await Promise.all([
    scoopyRequest<{ telegram_id: string; tier: string; balance_vnd: number; currency: string }>("/me"),
    (async () => {
      const collected: ScoopyProduct[] = [];
      let before: string | null = null;
      for (let page = 0; page < 10; page++) {
        const params = new URLSearchParams({ limit: "100" });
        if (before) params.set("before", before);
        const result = await scoopyRequest<{ items: ScoopyProduct[]; next_cursor: string | null }>(`/products?${params}`);
        collected.push(...result.items);
        if (!result.next_cursor) break;
        before = result.next_cursor;
      }
      return collected;
    })(),
  ]);
  return { account, products };
}

export async function createScoopySupplierOrder(productId: string, quantity: number, maxTotalVnd: number, idempotencyKey: string) {
  const response = await fetch(`${SCOOPY_BASE_URL}/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireApiKey()}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ product_id: productId, quantity, max_total_vnd: maxTotalVnd }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success !== true) {
    const message = payload?.error?.message;
    throw new Error(typeof message === "string" ? message : `Scoopy order failed (${response.status}).`);
  }
  const order = payload.data;
  if (!order?.id) throw new Error("Scoopy trả về đơn hàng không hợp lệ.");
  const details = Array.isArray(order.items) && order.items.length ? order : await getScoopyOrder(String(order.id));
  const totalVnd = Number.isSafeInteger(order.total_vnd) && order.total_vnd >= 0
    ? order.total_vnd as number
    : Number.isSafeInteger((details as any).total_vnd) && (details as any).total_vnd >= 0
      ? (details as any).total_vnd as number
      : null;
  return { id: String(order.id), items: Array.isArray(details.items) ? details.items as Array<{ sku: string; account: string }>: [], totalVnd };
}

export async function getScoopyOrder(orderId: string) {
  return scoopyRequest<{ id: string; items: Array<{ sku: string; account: string }> }>(`/orders/${encodeURIComponent(orderId)}`);
}


export function scoopyRetailPrice(sourcePrice: number, marginPercent: number) {
  return Math.ceil((sourcePrice * (1 + marginPercent / 100)) / 1000) * 1000;
}
