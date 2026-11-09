import { NextRequest, NextResponse } from "next/server";
import { subscribeRestock, unsubscribeRestock } from "@/lib/restock";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { productId, telegramId, username } = body;

    if (!productId || !telegramId) {
      return NextResponse.json(
        { error: "Thiếu thông tin sản phẩm hoặc tài khoản Telegram" },
        { status: 400 }
      );
    }

    const res = await subscribeRestock(Number(productId), String(telegramId), username);
    if (!res.success) {
      return NextResponse.json({ error: res.error || "Lỗi đăng ký" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      alreadySubscribed: res.alreadySubscribed,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Lỗi xử lý" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { productId, telegramId } = body;
    if (!productId || !telegramId) {
      return NextResponse.json({ error: "Thiếu thông tin" }, { status: 400 });
    }

    await unsubscribeRestock(Number(productId), String(telegramId));
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
