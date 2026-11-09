export type FulfillmentType = "MANUAL" | "API" | "HYBRID";

export type ProductAvailabilityInput = {
  stocks?: unknown;
  stockAvailable?: number | null;
  fulfillmentType?: string | null;
  supplierVariantId?: string | null;
  supplierConfigured?: boolean;
  supplierMaxQuantity?: number;
};

export function getManualStockCount(product: ProductAvailabilityInput | null | undefined): number {
  if (!product) return 0;
  const count = Array.isArray(product.stocks)
    ? product.stocks.length
    : Number(product.stockAvailable || 0);
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

export function getFulfillmentType(product: ProductAvailabilityInput): FulfillmentType {
  if (product.fulfillmentType === "MANUAL" || product.fulfillmentType === "API") {
    return product.fulfillmentType;
  }
  return "HYBRID";
}

export function canFulfillProduct(product: ProductAvailabilityInput | null | undefined): boolean {
  if (!product) return false;
  const stockCount = getManualStockCount(product);
  const supplierAvailable = Boolean(product.supplierVariantId?.trim() && product.supplierConfigured);
  const fulfillmentType = getFulfillmentType(product);
  if (fulfillmentType === "MANUAL") return stockCount > 0;
  if (fulfillmentType === "API") return supplierAvailable;
  return stockCount > 0 || supplierAvailable;
}

export function getMaxPurchaseQuantity(product: ProductAvailabilityInput | null | undefined): number {
  if (!product) return 0;
  const stockCount = getManualStockCount(product);
  const supplierAvailable = Boolean(product.supplierVariantId?.trim() && product.supplierConfigured);
  const supplierMax = Number.isSafeInteger(product.supplierMaxQuantity) && Number(product.supplierMaxQuantity) > 0
    ? Math.min(100, Number(product.supplierMaxQuantity))
    : 10;
  const fulfillmentType = getFulfillmentType(product);
  if (!supplierAvailable || fulfillmentType === "MANUAL") return stockCount;
  return fulfillmentType === "HYBRID" ? stockCount + supplierMax : supplierMax;
}

export function getPurchaseQuantities(product: ProductAvailabilityInput): number[] {
  const maxQuantity = getMaxPurchaseQuantity(product);
  if (!maxQuantity) return [];
  const quantities = new Set<number>([1]);
  for (const quantity of [2, 3, 5, 10]) {
    if (quantity <= maxQuantity) quantities.add(quantity);
  }
  if (maxQuantity <= 6) {
    for (let quantity = 1; quantity <= maxQuantity; quantity++) quantities.add(quantity);
  } else {
    quantities.add(maxQuantity);
  }
  return [...quantities].sort((a, b) => a - b);
}

export function generateOrderId(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return `DH${Array.from(bytes.slice(0, 6), (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

export function isSupportedOrderId(value: string): boolean {
  return /^DH(?:[A-F0-9]{8}|[A-F0-9]{12}|[A-F0-9]{32})$/i.test(value);
}
