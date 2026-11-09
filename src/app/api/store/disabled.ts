import { NextResponse } from "next/server";

export function storePurchasingDisabled() {
  return NextResponse.json(
    { error: "Mua hàng trên web đã tắt. Vui lòng đặt hàng qua Telegram bot @RINQ_bot." },
    {
      status: 410,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
