import { NextRequest, NextResponse } from "next/server";
import { checkAndProcessApi5sPayments, processApi5sTransaction } from "@/lib/api5s";

export async function GET() {
  const result = await checkAndProcessApi5sPayments();
  return NextResponse.json({
    success: true,
    service: "RINQ SHOP api5s ACB Checker",
    status: "ready",
    result,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // Nếu api5s hoặc webhook forward gửi một mảng giao dịch hoặc một giao dịch đơn
    if (Array.isArray(body?.transactions)) {
      let processed = 0;
      for (const tx of body.transactions) {
        const res = await processApi5sTransaction(tx);
        if (res.success && res.reason !== "ALREADY_PROCESSED") processed++;
      }
      return NextResponse.json({ success: true, processed });
    }

    if (body?.transactionID || body?.description) {
      const res = await processApi5sTransaction({
        transactionID: String(body.transactionID || body.id || Date.now()),
        amount: body.amount || body.transferAmount,
        description: body.description || body.content || "",
        transactionDate: body.transactionDate || new Date().toISOString(),
        type: String(body.type || body.transferType || "IN").toUpperCase() as "IN" | "OUT",
      });
      return NextResponse.json(res);
    }

    // Nếu không có body cụ thể, chủ động quét api5s.com
    const result = await checkAndProcessApi5sPayments();
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error("[api5s webhook] Lỗi:", error);
    return NextResponse.json({ error: error?.message || "Lỗi xử lý webhook api5s" }, { status: 500 });
  }
}
