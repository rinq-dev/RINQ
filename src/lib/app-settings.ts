import { prisma } from "./prisma";

export const PUBLIC_SETTING_KEYS = [
  "SHOP_NAME",
  "BOT_USERNAME",
  "SUPPORT_USERNAME",
  "BANK_ID",
  "BANK_ACCOUNT_NO",
  "BANK_ACCOUNT_NAME",
] as const;

export type AppSettingKey = (typeof PUBLIC_SETTING_KEYS)[number];

let settingsCache: { data: Record<string, string>; expiresAt: number } | null = null;

export async function getAppSettings(keys: readonly string[] = PUBLIC_SETTING_KEYS, forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && settingsCache && settingsCache.expiresAt > now) {
    return settingsCache.data;
  }
  try {
    const rows = await prisma.appSetting.findMany({ where: { key: { in: [...keys] } } });
    const data = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    settingsCache = { data, expiresAt: now + 60000 };
    return data;
  } catch {
    if (settingsCache) return settingsCache.data;
    return {};
  }
}

export function invalidateAppSettingsCache() {
  settingsCache = null;
}

export async function getPaymentSettings() {
  const saved = await getAppSettings(["BANK_ID", "BANK_ACCOUNT_NO", "BANK_ACCOUNT_NAME"]);
  return {
    bankId: saved.BANK_ID || process.env.BANK_ID || "MB",
    accountNo: saved.BANK_ACCOUNT_NO || process.env.BANK_ACCOUNT_NO || "",
    accountName: saved.BANK_ACCOUNT_NAME || process.env.BANK_ACCOUNT_NAME || "",
  };
}
