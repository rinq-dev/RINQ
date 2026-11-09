import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, isValidAdminSession } from "@/lib/admin-session";
import { syncRoboticPrices } from "@/lib/price-sync";

export const dynamic = "force-dynamic";

async function isAdmin(request: NextRequest) {
  return isValidAdminSession(request.cookies.get(COOKIE_NAME)?.value);
}

export async function POST(request: NextRequest) {
  if (!(await isAdmin(request))) {
    // Cho phép gọi bằng Cron secret key nếu có
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET || process.env.ADMIN_PASSWORD;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await syncRoboticPrices({
      notifyAdmin: true,
      broadcastCustomersOnDiscount: true,
    });

    return NextResponse.json({
      success: result.success,
      totalChecked: result.totalChecked,
      updatedCount: result.updatedCount,
      changes: result.changes,
      error: result.error,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lỗi đồng bộ giá" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
