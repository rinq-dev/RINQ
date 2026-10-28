import { NextRequest, NextResponse } from "next/server";
import { createWebAuthSession, checkWebAuthSession } from "@/lib/web-auth";

/**
 * POST /api/store/auth/session
 * Tạo phiên đăng nhập QR/Bot mới
 */
export async function POST() {
  try {
    const { token, expiresAt } = await createWebAuthSession();
    const botUsername = "rinq_bot";
    const botUrl = `https://t.me/${botUsername}?start=login_${token}`;

    return NextResponse.json({
      success: true,
      token,
      botUsername,
      botUrl,
      expiresAt,
    });
  } catch (error: any) {
    console.error("Lỗi tạo phiên đăng nhập:", error);
    return NextResponse.json(
      { error: "Không thể tạo phiên đăng nhập Telegram" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/store/auth/session?token=...
 * Kiểm tra trạng thái xác nhận của phiên
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token || !/^[a-f0-9]{32}$/i.test(token)) {
      return NextResponse.json({ error: "Token không hợp lệ" }, { status: 400 });
    }

    const result = await checkWebAuthSession(token);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Lỗi kiểm tra phiên đăng nhập:", error);
    return NextResponse.json(
      { error: "Lỗi kiểm tra phiên đăng nhập" },
      { status: 500 }
    );
  }
}
