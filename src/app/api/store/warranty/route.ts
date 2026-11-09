import { NextRequest, NextResponse } from "next/server";
import { processAutoWarranty, checkOrderWarrantyStatus } from "@/lib/warranty";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, telegramId } = body;

    if (!orderId || !telegramId) {
      return NextResponse.json(
        { error: "Thiếu thông tin đơn hàng hoặc tài khoản Telegram" },
        { status: 400 }
      );
    }

    const res = await processAutoWarranty(String(orderId), String(telegramId));
    if (!res.success) {
      return NextResponse.json(
        { error: res.error || "Không thể thực hiện bảo hành tự động", outOfStock: res.outOfStock },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      key: res.key,
      message: "Đổi bảo hành thành công!",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Lỗi xử lý" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("orderId");

    if (!orderId) {
      return NextResponse.json({ error: "Thiếu orderId" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { product: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Không tìm thấy đơn hàng" }, { status: 404 });
    }

    const status = checkOrderWarrantyStatus(order);
    return NextResponse.json({ success: true, status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
