import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { COOKIE_NAME, isValidAdminSession } from "@/lib/admin-session";

const KEYS = ["SHOP_NAME", "BOT_USERNAME", "SUPPORT_USERNAME", "BANK_ID", "BANK_ACCOUNT_NO", "BANK_ACCOUNT_NAME"] as const;
const safeString = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

async function authorized(request: NextRequest) { return isValidAdminSession(request.cookies.get(COOKIE_NAME)?.value); }

export async function GET(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const rows = await prisma.appSetting.findMany({ where: { key: { in: [...KEYS] } } });
    const saved = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    return NextResponse.json({ success: true, settings: { SHOP_NAME: saved.SHOP_NAME || "RINQ SHOP", BOT_USERNAME: saved.BOT_USERNAME || "RINQ_bot", SUPPORT_USERNAME: saved.SUPPORT_USERNAME || "rinq_hotro", BANK_ID: saved.BANK_ID || process.env.BANK_ID || "", BANK_ACCOUNT_NO: saved.BANK_ACCOUNT_NO || process.env.BANK_ACCOUNT_NO || "", BANK_ACCOUNT_NAME: saved.BANK_ACCOUNT_NAME || process.env.BANK_ACCOUNT_NAME || "", statuses: { telegram: Boolean(process.env.BOT_TOKEN), sepay: Boolean(process.env.SEPAY_API_KEY), robotic: Boolean(process.env.SUPPLIER_API_KEY), scoopy: Boolean(process.env.SCOOPY_API_KEY || process.env.SCOOPY_API_BASE_URL) } } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Không tải được cấu hình." }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  if (!(await authorized(request)) || request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const source = body?.settings && typeof body.settings === "object" ? body.settings : {};
    const values = { SHOP_NAME: safeString(source.SHOP_NAME, 80), BOT_USERNAME: safeString(source.BOT_USERNAME, 64).replace(/^@/, ""), SUPPORT_USERNAME: safeString(source.SUPPORT_USERNAME, 64).replace(/^@/, ""), BANK_ID: safeString(source.BANK_ID, 40), BANK_ACCOUNT_NO: safeString(source.BANK_ACCOUNT_NO, 32), BANK_ACCOUNT_NAME: safeString(source.BANK_ACCOUNT_NAME, 120) };
    if (!values.SHOP_NAME || !values.BOT_USERNAME || !values.SUPPORT_USERNAME || !values.BANK_ID || !values.BANK_ACCOUNT_NO || !values.BANK_ACCOUNT_NAME) return NextResponse.json({ error: "Vui lòng điền đủ các trường cấu hình." }, { status: 400 });
    if (!/^\d{4,32}$/.test(values.BANK_ACCOUNT_NO)) return NextResponse.json({ error: "Số tài khoản chỉ được gồm 4–32 chữ số." }, { status: 400 });
    await prisma.$transaction(KEYS.map((key) => prisma.appSetting.upsert({ where: { key }, update: { value: values[key] }, create: { key, value: values[key] } })));
    return NextResponse.json({ success: true, settings: values });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Không lưu được cấu hình." }, { status: 500 }); }
}
