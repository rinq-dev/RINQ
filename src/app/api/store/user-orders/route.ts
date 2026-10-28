import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptStock } from "@/lib/crypto";
import { verifyTelegramInitData } from "@/lib/telegram-auth";
import { checkWebAuthSession } from "@/lib/web-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/store/user-orders
 * Lấy lịch sử đơn hàng của người dùng Telegram (hỗ trợ cả Mini App lẫn Web Auth)
 */
export async function GET(req: NextRequest) {
  try {
    const initData = req.headers.get("x-telegram-init-data") || "";
    let telegramId: string | null = null;

    if (initData) {
      const telegram = verifyTelegramInitData(initData);
      if (telegram) telegramId = telegram.id;
    }

    if (!telegramId) {
      const webToken = req.headers.get("x-web-auth-token") || "";
      if (webToken && /^[a-f0-9]{32}$/i.test(webToken)) {
        const session = await checkWebAuthSession(webToken);
        if (session.verified && session.user?.telegramId) {
          telegramId = String(session.user.telegramId);
        }
      }
    }

    if (!telegramId) {
      return NextResponse.json({ error: "Phiên Telegram không hợp lệ hoặc đã hết hạn" }, { status: 401 });
    }

    const orders = await prisma.order.findMany({
      where: {
        telegramId,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            imageUrl: true,
            category: true,
          },
        },
        stocks: {
          select: {
            id: true,
            data: true,
          },
        },
      },
    });

    const formattedOrders = orders.map((o) => {
      const keys =
        o.status === "PAID"
          ? (o.stocks || []).map((s) => decryptStock(s.data))
          : [];

      return {
        id: o.id,
        productId: o.productId,
        productName: o.product?.name || "Sản phẩm",
        imageUrl: o.product?.imageUrl,
        category: o.product?.category,
        quantity: o.quantity,
        totalAmount: o.totalAmount,
        status: o.status,
        createdAt: o.createdAt,
        paidAt: o.paidAt,
        keys,
      };
    });

    return NextResponse.json(
      { success: true, orders: formattedOrders },
      { headers: { "Cache-Control": "no-store, private" } }
    );
  } catch (error: any) {
    console.error("Lỗi lấy danh sách đơn của user:", error);
    return NextResponse.json(
      { error: error?.message || "Lỗi truy vấn đơn hàng" },
      { status: 500 }
    );
  }
}
