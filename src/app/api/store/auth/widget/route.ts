import { NextRequest, NextResponse } from "next/server";
import { verifyTelegramWidgetData } from "@/lib/telegram-auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/store/auth/widget
 * Xác thực thông tin người dùng từ Telegram Login Widget
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const verified = verifyTelegramWidgetData(body);

    if (!verified) {
      return NextResponse.json(
        { error: "Dữ liệu xác thực Telegram không hợp lệ hoặc đã hết hạn" },
        { status: 401 }
      );
    }

    // Lưu hoặc cập nhật TelegramUser
    await prisma.telegramUser.upsert({
      where: { id: verified.id },
      update: {
        username: verified.username || null,
        firstName: verified.firstName || null,
      },
      create: {
        id: verified.id,
        username: verified.username || null,
        firstName: verified.firstName || null,
      },
    }).catch((e) => console.warn("Lỗi lưu TelegramUser:", e));

    return NextResponse.json({
      success: true,
      user: {
        id: Number(verified.id),
        telegramId: verified.id,
        username: verified.username || null,
        first_name: verified.firstName || "",
        photo_url: verified.photoUrl || null,
      },
    });
  } catch (error: any) {
    console.error("Lỗi xác thực Telegram Widget:", error);
    return NextResponse.json(
      { error: "Lỗi hệ thống khi xác thực" },
      { status: 500 }
    );
  }
}
