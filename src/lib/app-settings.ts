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
  const saved = await getAppSettings(["BANK_ID", "BANK_ACCOUNT_NO", "BANK_ACCOUNT_NAME", "API5S_ACB_TOKEN"]);
  return {
    bankId: saved.BANK_ID || process.env.BANK_ID || "ACB",
    accountNo: saved.BANK_ACCOUNT_NO || process.env.BANK_ACCOUNT_NO || "28753551",
    accountName: saved.BANK_ACCOUNT_NAME || process.env.BANK_ACCOUNT_NAME || "NGUYEN TAI PHAT",
    api5sToken: saved.API5S_ACB_TOKEN || process.env.API5S_ACB_TOKEN || "3018993f1aa9b3f0c2c4d51bd97d2340",
  };
}
