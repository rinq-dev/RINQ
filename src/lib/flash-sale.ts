import { prisma } from "./prisma";

export interface FlashSaleConfig {
  active: boolean;
  title: string;
  discountPercent: number;
  expiresAt: string;
}

let cachedFlashSale: FlashSaleConfig | null = null;
let lastCacheCheck = 0;

export async function getActiveFlashSale(): Promise<FlashSaleConfig | null> {
  const now = Date.now();
  if (cachedFlashSale && now - lastCacheCheck < 15000) {
    if (new Date(cachedFlashSale.expiresAt).getTime() > now && cachedFlashSale.active) {
      return cachedFlashSale;
    }
    cachedFlashSale = null;
  }
  lastCacheCheck = now;

  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: "FLASH_SALE_CONFIG" },
    });
    if (setting?.value) {
      const parsed: FlashSaleConfig = JSON.parse(setting.value);
      if (parsed.active && new Date(parsed.expiresAt).getTime() > now) {
        cachedFlashSale = parsed;
        return parsed;
      }
    }
  } catch {}

  cachedFlashSale = null;
  return null;
}

export async function startFlashSale(
  discountPercent: number,
  durationHours: number,
  title = "⚡ GIỜ VÀNG FLASH SALE"
): Promise<FlashSaleConfig> {
  const expiresAt = new Date(Date.now() + durationHours * 3600 * 1000).toISOString();
  const config: FlashSaleConfig = {
    active: true,
    title,
    discountPercent: Math.max(1, Math.min(90, Math.round(discountPercent))),
    expiresAt,
  };
  cachedFlashSale = config;

  await prisma.appSetting.upsert({
    where: { key: "FLASH_SALE_CONFIG" },
    update: { value: JSON.stringify(config) },
    create: { key: "FLASH_SALE_CONFIG", value: JSON.stringify(config) },
  });

  return config;
}

export async function stopFlashSale(): Promise<void> {
  cachedFlashSale = null;
  await prisma.appSetting.delete({
    where: { key: "FLASH_SALE_CONFIG" },
  }).catch(() => {});
}

export function calculateFlashSalePrice(price: number, discountPercent: number): number {
  const discountAmount = Math.round((price * discountPercent) / 100);
  return Math.max(1000, price - discountAmount);
}

export function formatRemainingTime(expiresAt: string): string {
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  if (diffMs <= 0) return "Sắp kết thúc";
  const hours = Math.floor(diffMs / (3600 * 1000));
  const mins = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000));
  if (hours > 0) {
    return `${hours} giờ ${mins} phút`;
  }
  return `${mins} phút`;
}
