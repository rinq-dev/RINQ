import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAllCoupons, validateCoupon } from "@/lib/promo";

// Helper chuyển BigInt nếu có
function jsonResponse(data: any, status = 200) {
  const serialized = JSON.stringify(data, (_, v) =>
    typeof v === "bigint" ? Number(v) : v
  );
  return new NextResponse(serialized, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * GET /api/store
 * Trả về danh sách sản phẩm đang hoạt động, danh mục và cấu hình thanh toán
 */
export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      include: {
        stocks: {
          where: { isSold: false },
          select: { id: true },
        },
      },
    });

    const categories = Array.from(
      new Set(
        products
          .map((p) => p.category?.trim())
          .filter((c): c is string => Boolean(c && c.length > 0))
      )
    );

    const formattedProducts = products.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      description: p.description,
      category: p.category || "Chung",
      priceNote: p.priceNote,
      imageUrl: p.imageUrl,
      stockAvailable: p.stocks.length,
      isAutoApi: Boolean(p.supplierVariantId),
    }));

    return jsonResponse({
      success: true,
      products: formattedProducts,
      categories,
      bankInfo: {
        bankId: process.env.BANK_ID || "TPBank",
        bankAccountNo: process.env.BANK_ACCOUNT_NO || "0123456789",
        bankAccountName: process.env.BANK_ACCOUNT_NAME || "RINQ SHOP",
      },
    });
  } catch (error: any) {
    console.error("Lỗi lấy dữ liệu store:", error);
    return NextResponse.json(
      { error: "Lỗi hệ thống khi tải sản phẩm" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/store
 * Kiểm tra mã giảm giá
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { code, amount } = body;

    if (!code || !amount) {
      return NextResponse.json(
        { error: "Thiếu mã giảm giá hoặc số tiền" },
        { status: 400 }
      );
    }

    const check = await validateCoupon(code, Number(amount));
    return NextResponse.json(check);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Lỗi kiểm tra coupon" },
      { status: 500 }
    );
  }
}

