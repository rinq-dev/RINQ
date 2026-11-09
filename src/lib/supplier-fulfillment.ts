import { createScoopySupplierOrder } from "./scoopy";
import { createSupplierOrder, getSupplierDelivery } from "./supplier";

export interface SupplierFulfillmentResult {
  success: boolean;
  items: string[];
  supplierOrderId?: string;
  error?: string;
}

/**
 * Tự động mua và nhận bàn giao tài nguyên từ nhà cung cấp API (RoboticVN hoặc ScoopyVN)
 */
export async function fulfillFromSupplier(
  supplierVariantId: string,
  quantity: number,
  maxPricePerItem: number = 2_000_000
): Promise<SupplierFulfillmentResult> {
  if (!supplierVariantId || !supplierVariantId.trim()) {
    return { success: false, items: [], error: "Sản phẩm chưa cấu hình mã NCC" };
  }

  const trimmed = supplierVariantId.trim();

  // 1. Nhà cung cấp ScoopyVN
  if (trimmed.startsWith("SCOOPY:")) {
    const scoopyProductId = trimmed.slice("SCOOPY:".length);
    const idempotencyKey = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const maxTotalVnd = Math.max(10_000, maxPricePerItem * quantity);
    try {
      const scoopyOrder = await createScoopySupplierOrder(
        scoopyProductId,
        quantity,
        maxTotalVnd,
        idempotencyKey
      );
      if (scoopyOrder.items && scoopyOrder.items.length > 0) {
        return {
          success: true,
          supplierOrderId: scoopyOrder.id,
          items: scoopyOrder.items.map((it) => it.account),
        };
      }
      return {
        success: false,
        items: [],
        supplierOrderId: scoopyOrder.id,
        error: "ScoopyVN đang xử lý đơn hàng hoặc kho tạm hết.",
      };
    } catch (err: any) {
      return {
        success: false,
        items: [],
        error: err?.message || "Lỗi tạo đơn qua ScoopyVN API",
      };
    }
  }

  // 2. Nhà cung cấp RoboticVN
  const roboticVariantId = trimmed.startsWith("ROBOTIC:")
    ? trimmed.slice("ROBOTIC:".length)
    : trimmed;
  try {
    const supOrder = await createSupplierOrder(roboticVariantId, quantity);
    if (supOrder.success && supOrder.orderId) {
      const supDelivery = await getSupplierDelivery(supOrder.orderId);
      if (supDelivery.success && supDelivery.items && supDelivery.items.length > 0) {
        return {
          success: true,
          supplierOrderId: supOrder.orderId,
          items: supDelivery.items.map((it) => it.rawText),
        };
      }
      return {
        success: false,
        items: [],
        supplierOrderId: supOrder.orderId,
        error: supDelivery.error || "Chưa nhận được bàn giao từ RoboticVN",
      };
    }
    return {
      success: false,
      items: [],
      error: supOrder.error || "Lỗi tạo đơn qua RoboticVN API",
    };
  } catch (err: any) {
    return {
      success: false,
      items: [],
      error: err?.message || "Lỗi kết nối API RoboticVN",
    };
  }
}
