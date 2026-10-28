import { NextResponse } from "next/server";
import { isBotOnline } from "@/lib/bot-status";

export const dynamic = "force-dynamic";

/**
 * GET /api/store/bot-status
 * Kiểm tra xem Telegram Bot hiện có đang chạy hay không
 */
export async function GET() {
  try {
    const online = await isBotOnline();
    return NextResponse.json(
      { success: true, online },
      { headers: { "Cache-Control": "no-store, private" } }
    );
  } catch (err: any) {
    return NextResponse.json({ success: true, online: false });
  }
}
