import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, isValidAdminSession } from "@/lib/admin-session";
import { rewriteProductContent } from "@/lib/ai-service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!(await isValidAdminSession(token))) {
      return NextResponse.json({ error: "Chưa đăng nhập quyền quản trị" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { text, productName, category, tone } = body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Vui lòng nhập nội dung cần viết lại" }, { status: 400 });
    }

    const result = await rewriteProductContent({
      text: text.trim(),
      productName: productName ? String(productName).trim() : undefined,
      category: category ? String(category).trim() : undefined,
      tone: tone || "telegram",
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Lỗi xử lý AI viết lại nội dung" },
      { status: 500 }
    );
  }
}
