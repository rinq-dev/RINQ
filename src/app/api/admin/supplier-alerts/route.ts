import { NextResponse } from "next/server";
import { getRoboticCatalog } from "@/lib/robotic";
import { getScoopyCatalog } from "@/lib/scoopy";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export interface SupplierAlertsResponse {
  balances: {
    robotic: {
      connected: boolean;
      name: string;
      balanceVnd: number;
      isLow: boolean;
      error?: string;
    };
    scoopy: {
      connected: boolean;
      name: string;
      balanceVnd: number;
      isLow: boolean;
      error?: string;
    };
  };
  priceAlerts: Array<{
    id: number;
    name: string;
    supplier: "ROBOTIC" | "SCOOPY";
    oldCost: number | null;
    newCost: number;
    currentRetail: number;
    suggestedRetail: number;
    diffPercent: number;
    isIncrease: boolean;
  }>;
  summary: {
    hasAlert: boolean;
    lowBalanceSuppliers: string[];
    priceChangesCount: number;
  };
}

const LOW_BALANCE_THRESHOLD = 150_000; // Cảnh báo khi số dư dưới 150.000 VNĐ

export async function GET() {
  try {
    // 1. Kiểm tra RoboticVN
    let roboticBalance = 0;
    let roboticConnected = false;
    let roboticError: string | undefined;
    let roboticProducts: any[] = [];

    if (process.env.ROBOTIC_ENABLED !== "false") {
      try {
        const catalog = await getRoboticCatalog({}, true);
        roboticConnected = true;
        roboticBalance = Number(catalog.account?.balanceVnd || 0);
        roboticProducts = catalog.products || [];
      } catch (err: any) {
        roboticError = err?.message || "Không thể kết nối RoboticVN";
      }
    } else {
      roboticError = "Đã tạm tắt nguồn RoboticVN";
    }

    // 2. Kiểm tra ScoopyVN
    let scoopyBalance = 0;
    let scoopyConnected = false;
    let scoopyError: string | undefined;
    let scoopyProducts: any[] = [];

    try {
      const catalog = await getScoopyCatalog();
      scoopyConnected = true;
      scoopyBalance = Number(catalog.account?.balance_vnd || 0);
      scoopyProducts = catalog.products || [];
    } catch (err: any) {
      scoopyError = err?.message || "Không thể kết nối ScoopyVN";
    }

    // 3. Quét biến động giá vốn sản phẩm
    const localProducts = await prisma.product.findMany({
      where: {
        supplierVariantId: { not: null },
      },
      select: {
        id: true,
        name: true,
        price: true,
        lastSupplierPrice: true,
        supplierVariantId: true,
        retailMarginPercent: true,
      },
    });

    const priceAlerts: SupplierAlertsResponse["priceAlerts"] = [];

    // Map sản phẩm Robotic
    const roboticMap = new Map(
      roboticProducts.map((p) => [`${p.id}:${p.variantId}`, p])
    );
    // Map sản phẩm Scoopy
    const scoopyMap = new Map(
      scoopyProducts.map((p) => [String(p.id), p])
    );

    for (const prod of localProducts) {
      if (!prod.supplierVariantId) continue;

      if (prod.supplierVariantId.startsWith("ROBOTIC:")) {
        const key = prod.supplierVariantId.slice("ROBOTIC:".length);
        const remote = roboticMap.get(key);
        if (remote) {
          const newCost = Number(remote.sourcePrice || 0);
          const oldCost = prod.lastSupplierPrice;
          if (oldCost !== null && oldCost > 0 && newCost !== oldCost) {
            const margin = prod.retailMarginPercent ?? 15;
            const suggestedRetail = Math.round(newCost * (1 + margin / 100));
            const diffPercent = Math.round(((newCost - oldCost) / oldCost) * 100);
            priceAlerts.push({
              id: prod.id,
              name: prod.name,
              supplier: "ROBOTIC",
              oldCost,
              newCost,
              currentRetail: prod.price,
              suggestedRetail,
              diffPercent,
              isIncrease: newCost > oldCost,
            });
          }
        }
      } else if (prod.supplierVariantId.startsWith("SCOOPY:")) {
        const key = prod.supplierVariantId.slice("SCOOPY:".length);
        const remote = scoopyMap.get(key);
        if (remote) {
          const newCost = Number(remote.price_vnd || 0);
          const oldCost = prod.lastSupplierPrice;
          if (oldCost !== null && oldCost > 0 && newCost !== oldCost) {
            const margin = prod.retailMarginPercent ?? 15;
            const suggestedRetail = Math.round(newCost * (1 + margin / 100));
            const diffPercent = Math.round(((newCost - oldCost) / oldCost) * 100);
            priceAlerts.push({
              id: prod.id,
              name: prod.name,
              supplier: "SCOOPY",
              oldCost,
              newCost,
              currentRetail: prod.price,
              suggestedRetail,
              diffPercent,
              isIncrease: newCost > oldCost,
            });
          }
        }
      }
    }

    const lowBalanceSuppliers: string[] = [];
    if (roboticConnected && roboticBalance < LOW_BALANCE_THRESHOLD) {
      lowBalanceSuppliers.push("RoboticVN");
    }
    if (scoopyConnected && scoopyBalance < LOW_BALANCE_THRESHOLD) {
      lowBalanceSuppliers.push("ScoopyVN");
    }

    const payload: SupplierAlertsResponse = {
      balances: {
        robotic: {
          connected: roboticConnected,
          name: "RoboticVN",
          balanceVnd: roboticBalance,
          isLow: roboticConnected && roboticBalance < LOW_BALANCE_THRESHOLD,
          error: roboticError,
        },
        scoopy: {
          connected: scoopyConnected,
          name: "ScoopyVN",
          balanceVnd: scoopyBalance,
          isLow: scoopyConnected && scoopyBalance < LOW_BALANCE_THRESHOLD,
          error: scoopyError,
        },
      },
      priceAlerts,
      summary: {
        hasAlert: lowBalanceSuppliers.length > 0 || priceAlerts.length > 0,
        lowBalanceSuppliers,
        priceChangesCount: priceAlerts.length,
      },
    };

    return NextResponse.json(payload);
  } catch (err: any) {
    console.error("[supplier-alerts API] Lỗi:", err);
    return NextResponse.json(
      { error: err?.message || "Lỗi kiểm tra cảnh báo nhà cung cấp" },
      { status: 500 }
    );
  }
}
